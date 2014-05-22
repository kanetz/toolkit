var program = require('commander'),
    url = require('url'),
    request = require('request'),
    exec = require('child_process').exec,
    logger = require('log4js').getLogger('main');

program
    .version('0.0.1')
    .option('-s, --server <server address>', 'Go Server Address', 'http://10.18.7.153:8153')
    .option('-p, --pipeline <pipeline name>', 'Pipeline Name', 'Tiger.Core')
    .option('-i, --interval <interval in milliseconds>', 'Polling Interval', parseInt, 500)
    .option('-r, --repository <repository path>', 'Repository Path', 'C:/Workspace/Tiger')
    .parse(process.argv);

var pipelineHistoryFeedUrl = url.resolve(program.server, '/go/pipelineHistory.json?pipelineName=' + program.pipeline);
logger.info('Retrieving pipeline history at', pipelineHistoryFeedUrl);
watchPipeline();

function watchPipeline() {
    'use strict';
    request(pipelineHistoryFeedUrl, piplineHistoryFeedHandler);
}

function piplineHistoryFeedHandler(error, response, body) {
    'use strict';
    if(!error && response.statusCode === 200) {
        parsingHandler(JSON.parse(body.replace(/\\'/g, "'")));
    }
    else {
        logger.info('Error occurred, will try again in', program.interval, 'ms');
        setTimeout(watchPipeline, program.interval);
    }
}

function parsingHandler(pipeline) {
    'use strict';

    var isPipelineLocked = pipeline.groups[0].history[0].stages.some(function(stage) {
        return stage.stageStatus !== "Passed";
    });

    if(isPipelineLocked) {
        logger.info('Pipeline is locked, will try again in', program.interval, 'ms');
        setTimeout(watchPipeline, program.interval);
    }
    else {
        logger.info('Pipeline is ready, push changes now.');
        commitChanges();
    }
}

function commitChanges() {
    'use strict';
    exec('git push', {cwd: program.repository}, function(error, stdout, stderr) {
        logger.info(stdout);
        logger.error(stderr);
        if(error) {
            throw new Error(error);
        }
    });
}
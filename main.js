var program = require('commander'),
    url = require('url'),
    request = require('request'),
    xml2js = require('xml2js'),
    exec = require('child_process').exec,
    logger = require('log4js').getLogger('main');

program
    .version('0.0.1')
    .option('-s, --server <server address>', 'Go Server Address', 'http://10.18.7.153:8153')
    .option('-p, --pipeline <pipeline name>', 'Pipeline Name', 'Tiger.Core')
    .option('-i, --interval <interval in milliseconds>', 'Polling Interval', parseInt, 1000)
    .option('-r, --repository <repository path>', 'Repository Path', 'C:/Workspace/Tiger')
    .parse(process.argv);

var cctrayUrl = url.resolve(program.server, '/go/cctray.xml');
var pipelinePattern = new RegExp('^' + program.pipeline);
logger.info('Retrieving pipeline status at', cctrayUrl);
watchPipeline();

function watchPipeline() {
    'use strict';
    request(cctrayUrl, cctrayFeedHandler);
}

function cctrayFeedHandler(error, response, body) {
    'use strict';
    if(!error && response.statusCode === 200) {
        var parsingOptions = {
            mergeAttrs: true,
            normalizeTags: true,
            explicitArray: false
        };
        xml2js.parseString(body, parsingOptions, xmlParsingHandler);
    }
    else {
        logger.info('Error occurred, will try again in', program.interval, 'ms');
        setTimeout(watchPipeline, program.interval);
    }
}

function xmlParsingHandler(error, result) {
    'use strict';

    var isPipelineLocked = result.projects.project
        .some(function(project) {
            return pipelinePattern.test(project.name) &&
                (project.activity !== 'Sleeping' || project.lastBuildStatus !== 'Success');
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
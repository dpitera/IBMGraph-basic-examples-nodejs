var express = require('express');
var cfenv = require('cfenv');
var app = express();
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var request = require('request-promise'); /* Note: using promise-friendly lib */
var uuid = require('node-uuid');
var appEnv = cfenv.getAppEnv();
var util = require('util');
var sleep = require('sleep');

app.set('port', process.env.PORT);
app.use(express.static(__dirname + '/public'));

/* Please provision an instance of IBMGraph and update these variables with your personal data */
var gURL = 'https://localhost:3001/service123/g';
var gUsername = 'e559051b-c3f4-4fec-84bc-6b8305b875e6';
var gPassword = '9a96c7f8-c5a5-4c3c-a36b-7e8c6e86dfc3';
var numIndexes = 2;
var SEC_WAIT_BEFORE_CHECK_STATUS = 45;

if (!gURL || !gUsername || !gPassword) {
    console.log('Please provision your own instance of IBM Graph and replace' +
      'your credentials in the code');
    process.exit(1);
}

var gBaseURL = gURL.split('/g').join('');

//Some env variables
var vertex1; var vertex2; var vertex3; var vertex4;
var edge1; var edge2;

// Get session token
console.log('Getting session token');
var sessionToken;
var graphUserPassPostOpts = {
    method: 'GET',
    uri: gBaseURL + '/_session',
    auth: {user: gUsername, pass: gPassword},
    json: true, // Automatically parses the JSON string in the response
    rejectUnauthorized: false
};
request(graphUserPassPostOpts).then(function (body) {
    sessionToken = 'gds-token ' + body['gds-token'];
    console.log('received sessionToken: ', sessionToken);
    console.log('\n*******************\n');

    //Now we will create a new graph
    //Since schemas are immutable, this is useful to begin in a clean environment
    console.log('Creating new graph');
    var graphCreateOpts = {
        method: 'POST',
        headers: {'Authorization': sessionToken},
        uri: gBaseURL + '/_graphs',
        json: true,
        rejectUnauthorized: false
    };
    return request(graphCreateOpts);
}).then(function (body) {
    gURL = body.dbUrl;
    console.log('Successfully created a graph. The new apiURL is :', gURL);
    console.log('\n*******************\n');

    var indexOpts = [];
    for (var j = 0; j < numIndexes; j++) {
        var body = {
            'type': 'vertex',
            'name': util.format('index%s', j),
            'unique': false,
            'composite': true,
            'propertyKeys': [
                {'name': 'propKey', 'cardinality': 'SINGLE', 'dataType': 'String'}
            ]
        };
        var indexOpt = {
            method: 'POST',
            headers: {'Authorization': sessionToken},
            uri: gURL + '/index',
            json: body,
            rejectUnauthorized: false
        };
        indexOpts.push(indexOpt);
    }
    return Promise.map(indexOpts, function (indexOpt) {
        return request(indexOpt);
    }, {concurrency: 1});
}).then(function (body) {
    console.log('finished creating all indexes');
    sleep.sleep(SEC_WAIT_BEFORE_CHECK_STATUS);
    var indexes = [];
    for (var j = 0; j < numIndexes; j++) {
        console.log(util.format('body from creating index%s is %s',
          j, JSON.stringify(body[j].result.data)));

        var indexOpts = {
            method: 'GET',
            headers: {'Authorization': sessionToken},
            uri: gURL + util.format('/index/index%s/status', j),
            rejectUnauthorized: false,
            json: true
        };
        indexes.push(request(indexOpts));
    }
    return Promise.all(indexes);
}).then(function (body) {
    for (var j = 0; j < numIndexes; j++) {
        console.log(util.format('index%s status is %s',
            j, JSON.stringify(body[j].result.data)));
    }
}).catch(function (error) {
    console.log('Encountered the following error: ', error);
});

// start server on the specified port and binding host
app.listen(appEnv.port, '0.0.0.0', function () {
    // print a message when the server starts listening
    console.log('server starting on ' + appEnv.url);
});

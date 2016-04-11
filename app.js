var express = require('express');
var cfenv = require('cfenv');
var app = express();
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var request = require('request-promise'); /* Note: using promise-friendly lib */
var uuid = require('node-uuid');
var appEnv = cfenv.getAppEnv();
var util = require('util');

app.set('port', process.env.PORT);
app.use(express.static(__dirname + '/public'));

/* Please provision an instance of IBMGraph and update these variables with your personal data */
var gURL = null;
var gUsername = null;
var gPassword = null;

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
    json: true // Automatically parses the JSON string in the response
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
        json: true
    };
    return request(graphCreateOpts);
}).then(function (body) {
    gURL = body.dbUrl;
    console.log('Successfully created a graph. The new apiURL is :', gURL);
    console.log('\n*******************\n');

    //Now we will POST a schema
    //First we open read the schema from a file
    console.log('Creating a schema');
    return fs.readFileAsync('./public/json/schema.json', 'utf-8');
}).then(function (data) {
    //Now send the request to IBM Graph
    var postSchemaOpts = {
        method: 'POST',
        headers: {'Authorization': sessionToken},
        uri: gURL + '/schema',
        json: JSON.parse(data.toString())
    };
    return request(postSchemaOpts);
}).then(function (body) {
    console.log('successfuly post schema and here is the response : ' + JSON.stringify(body));
    console.log('\n*******************\n');

    //Now we will create a vertex
    var body = {
        'label': 'tweet',
        'properties': {
            'tweet': 'I love the movies #movies @joseph',
            'tone': 'sad',
            'sentiment': 'enduring'
        }
    };
    var postVertexOpts = {
        method: 'POST',
        headers: {'Authorization': sessionToken},
        uri: gURL + '/vertices',
        json: body
    };
    console.log('Creating a tweet vertex');
    return request(postVertexOpts);
}).then(function (body) {
    vertex1 = body.result.data[0].id;
    console.log('successfully created tweet vertex and its id is : ', vertex1);
    console.log('\n*******************\n');

    //Create hashtag vertex
    console.log('Creating hashtag vertex');
    var body = {
        'label': 'hashtag',
        'properties': {
            'hashtag': 'movies',
            'numTimes': 1000
        }
    };
    var postVertexOpts = {
        method: 'POST',
        headers: {'Authorization': sessionToken},
        uri: gURL + '/vertices',
        json: body
    };
    return request(postVertexOpts);
}).then(function (body) {
    vertex2 = body.result.data[0].id;
    console.log('successfully created hashtag vertex and its id is : ', vertex2);
    console.log('\n*******************\n');

    //Create person vertex, for the person who tweeted the tweet
    console.log('Creating person vertex, for person who tweeted the tweet');
    var body = {
        'label': 'person',
        'properties': {
            'name': 'Jessica',
            'verified': false
        }
    };
    var postVertexOpts = {
        method: 'POST',
        headers: {'Authorization': sessionToken},
        uri: gURL + '/vertices',
        json: body
    };
    return request(postVertexOpts);
}).then(function (body) {
    vertex3 = body.result.data[0].id;
    console.log('successfully created person vertex and its id is : ', vertex3);
    console.log('\n*******************\n');

    //Create person vertex, for the person who tweeted the tweet
    console.log('Creating person vertex, for person who was mentioned in the tweet');
    var body = {
        'label': 'person',
        'properties': {
            'name': 'Joseph',
            'verified': true
        }
    };
    var postVertexOpts = {
        method: 'POST',
        headers: {'Authorization': sessionToken},
        uri: gURL + '/vertices',
        json: body
    };
    return request(postVertexOpts);
}).then(function (body) {
    vertex4 = body.result.data[0].id;
    console.log('successfully created person vertex and its id is : ', vertex4);
    console.log('\n*******************\n');

    //Now we will update the tweet vertex
    var body = {
        'properties': {
            'tone': 'happy',
            'sentiment': 'loving'
        }
    };
    var puttVertexOpts = {
        method: 'PUT',
        headers: {'Authorization': sessionToken},
        uri: gURL + '/vertices/' + vertex1,
        json: body
    };
    console.log('Updating a vertex');
    return request(puttVertexOpts);
}).then(function (body) {
    console.log('successfully updated the tweet vertex and its new values are' +
        JSON.stringify(body.result.data[0]));
    console.log('\n*******************\n');

    //Now we will create an edge
    //between person who tweeted -> tweet
    //Edges *must* include 'inV', 'outV', and 'label' in the POST body and
    //these values are immutable
    //Note: you can also include edgeIndexes for querying these edges,
    //however, this example does not include edgeIndexes. edgeIndexes are mutable
    var body = {
        'inV': vertex1,
        'outV': vertex3,
        'label': 'tweets'
    };
    var postEdgeOpts = {
        method: 'POST',
        headers: {'Authorization': sessionToken},
        uri: gURL + '/edges',
        json: body
    };
    console.log('Creating create an edge between person who tweeted -> tweet');
    return request(postEdgeOpts);
}).then(function (body) {
    edge1 = body.result.data[0].id;
    console.log('successfully created the edge and its id is : ', edge1);
    console.log('\n*******************\n');

    //Now we will create an edge
    //between person who tweet -> hashtag
    var body = {
        'inV': vertex2,
        'outV': vertex1,
        'label': 'hashes'
    };
    var postEdgeOpts = {
        method: 'POST',
        headers: {'Authorization': sessionToken},
        uri: gURL + '/edges',
        json: body
    };
    console.log('Creating create an edge between tweet -> hashtag');
    return request(postEdgeOpts);
}).then(function (body) {
    edge2 = body.result.data[0].id;
    console.log('successfully created the edge and its id is : ', edge2);
    console.log('\n*******************\n');

    //Now we will create an edge
    //between person who tweet -> person mentioned in tweet
    var body = {
        'inV': vertex2,
        'outV': vertex1,
        'label': 'mentions'
    };
    var postEdgeOpts = {
        method: 'POST',
        headers: {'Authorization': sessionToken},
        uri: gURL + '/edges',
        json: body
    };
    console.log('Creating create an edge between tweet -> person mentioned in tweet');
    return request(postEdgeOpts);
}).then(function (body) {
    edge3 = body.result.data[0].id;
    console.log('successfully created the edge and its id is : ', edge3);
    console.log('\n*******************\n');

    //Now we will GET a vertex by its ID
    console.log('getting a vertex by its id');
    var getVertexOpts = {
        method: 'GET',
        headers: {'Authorization': sessionToken},
        uri: gURL + '/vertices/' + vertex1,
        json: true
    };
    return request(getVertexOpts);
}).then(function (body) {
    console.log('successfully got the vertex and its data is : ' +
        JSON.stringify(body.result.data[0]));
    console.log('\n*******************\n');

    //Now we will GET a vertex by an indexed property
    console.log('getting a vertex by an indexed property');
    var getVertexOpts = {
        method: 'GET',
        headers: {'Authorization': sessionToken},
        uri: gURL + '/vertices?name=Jessica',
        json: true
    };
    return request(getVertexOpts);
}).then(function (body) {
    console.log('successfully got the vertex and its data is : ' +
        JSON.stringify(body.result.data[0]));
    console.log('\n*******************\n');

    //Now we will GET a vertex by multiple indexed properties
    console.log('getting a vertex by multiple indexed properties');
    var getVertexOpts = {
        method: 'GET',
        headers: {'Authorization': sessionToken},
        uri: gURL + '/vertices?tone=happy&sentiment=loving',
        json: true
    };
    return request(getVertexOpts);
}).then(function (body) {
    console.log('successfully got the vertex and its data is : ' +
        JSON.stringify(body.result.data[0]));
    console.log('\n*******************\n');

    //Now we will GET a vertex by querying based on label and indexed property
    //Note: you must still query based on indexed property
    //You cannot query based on label alone
    console.log('getting a vertex by an indexed property and label');
    var getVertexOpts = {
        method: 'GET',
        headers: {'Authorization': sessionToken},
        uri: gURL + '/vertices?tone=happy&sentiment=loving&label=tweet',
        json: true
    };
    return request(getVertexOpts);
}).then(function (body) {
    console.log('successfully got the vertex and its data is : ' +
        JSON.stringify(body.result.data[0]));
    console.log('\n*******************\n');

    //Now we will perform a basic gremlin query
    //This query will return all vertices connected by an outgoing edge
    //from our tweet vertex
    console.log('running a gremlin query');
    console.log('this example should return all vertices connected by ' +
        'an outgoing edge from our tweet vertex');
    var body = {
        'gremlin': 'def g = graph.traversal(); g.V(' + vertex1 + ').outE().inV()'
    };
    var gremlinQueryOpts = {
        method: 'POST',
        headers: {'Authorization': sessionToken},
        uri: gURL + '/gremlin',
        json: body
    };
    return request(gremlinQueryOpts);
}).then(function (body) {
    for (var i = 0; i < body.result.data.length; i++) {
        console.log('successfully found this vertex : ' +
            JSON.stringify(body.result.data[i]));
    }
    console.log('\n*******************\n');

    //delete a vertex
    console.log('deleting a vertex');
    var deleteVertexOpts = {
        method: 'DELETE',
        headers: {'Authorization': sessionToken},
        uri: gURL + '/vertices/' + vertex1,
    };
    return request(deleteVertexOpts);
}).then(function (body) {
    console.log('successfully deleted a vertex and response was' +
         JSON.stringify(body));
    console.log('\n*******************\n');

    //Delete an edge
    console.log('deleting an edge');
    var deleteEdgeOpts = {
        method: 'DELETE',
        headers: {'Authorization': sessionToken},
        uri: gURL + '/edges/' + edge2,
    };
    return request(deleteEdgeOpts);
}).then(function (body) {
    console.log('successfully deleted an edge and response was' +
        JSON.stringify(body));
    console.log('\n*******************\n');

    process.exit(0);
}).catch(function (error) {
    console.log('Encountered the following error: ', error);
});

// start server on the specified port and binding host
app.listen(appEnv.port, '0.0.0.0', function () {
    // print a message when the server starts listening
    console.log('server starting on ' + appEnv.url);
});


var express = require('express');
var bodyParser = require('body-parser');
var app = express();

require('dotenv').config({path: __dirname + '/.env.local'});
const taskrouter = require('twilio').jwt.taskrouter;
const { AccessToken } = require('twilio').jwt;
const twilio = require('twilio');
const { TaskQueueCapability, WorkspaceCapability, WorkerCapability } = require('twilio').jwt.taskrouter;
const util = taskrouter.util;

const { Twilio } = require('twilio');
const { VoiceGrant } = require('twilio/lib/jwt/AccessToken');
const TaskRouterCapability = taskrouter.TaskRouterCapability;
const Policy = TaskRouterCapability.Policy;
const TASKROUTER_BASE_URL = 'https://taskrouter.twilio.com';
const version = 'v1';

const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_TOKEN;
const apiKeySid = process.env.TWILIO_API_KEY_SID;
const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
const workspaceSid = process.env.TWILIO_WORKSPACE_SID;

app.use(express.static(__dirname));
app.use(express.static(__dirname + '/node_modules'));
app.get('/', function(req, res) {
    res.sendFile('./index.html', {root: __dirname });
});

var config = require('./config.json');

function getWorkerSid(workerName) {
    let worker = workers.find(function(w) { w.name === workerName });
    if(worker) {
        return worker.sid;
    }
    return '';
}

const workers = config.workers;

const customers = config.customers;

const queues = config.queues;

// Helper function to create Policy
function buildWorkspacePolicy(options) {
    options = options || {};
    var resources = options.resources || [];
    var urlComponents = [TASKROUTER_BASE_URL, version, 'Workspaces', workspaceSid]
  
    return new Policy({
      url: urlComponents.concat(resources).join('/'),
      method: options.method || 'GET',
      allow: true
    });
  }

app.use(bodyParser.json());

app.get('/test-get', function(req, res) {
    console.log('query = ',req.query);
    console.log(config);
    res.json({message: 'success'});
});

app.post('/test-post', function(req, res) {
    console.log('body = ',req.body);
    res.json({message: 'success'});
});
var chatShowerTimer = null;

app.post('/chat/shower/start', function(req, res) {
    console.log(req.body);
    let frequency = req.body.frequency;
    if(isNaN(frequency) || frequency <= 0 || frequency >= 1000) {
        res.json({error: 'Frequency must be greater than 0 and less than 1000'});
        return;
    }
    let phoneNumber = req.body.phoneNumber;
    if(phoneNumber === '') {
        res.json({error: 'Please select a queue'});
        return;
    }
    let customerList = req.body.customerList;
    if(!Array.isArray(customerList) || customerList.length === 0) {
        res.json({error: 'Please select at least one customer'});
        return;
    }
    res.json({message: 'Starting chat shower, sending ' + frequency + ' messages/minute'});
    chatShowerTimer = setInterval(function() {
        chatShower(phoneNumber, customerList);
    }, 60000/frequency);
});

app.post('/chat/shower/stop', function(req, res) {
    clearInterval(chatShowerTimer);
    res.json({message: 'Chat shower stopped'});
});

var showerCount = 0;

var client = null;

async function chatShower(targetPhoneNumber, customerList) {
    if(client === null) {
        client = new twilio(accountSid, authToken);
    }
    showerCount++;
    customerList.forEach(async function(customer) {
        let message = customer.message + '(' + showerCount + ')';
        await client.messages.create({
            from: customer.phoneNumber,
            to: targetPhoneNumber,
            body: message
        }).catch(function(err) {
            console.log('error sending message', err);
        });
    });
}

app.get('/worker/list', function(req, res) {
    res.json(workers);
});

app.get('/customer/list', function(req, res) {
    res.json(customers);
});

app.get('/queue/list', function(req, res) {
    res.json(queues);
});

app.get('/worker/token', function(req, res) {
    let workerName = req.query.workerName;
    let workerSid = getWorkerSid(workerName);
    let token = new AccessToken(accountSid, apiKeySid, apiKeySecret, 
        { ttl: 3600, 
          identity: workerName
        });
    let grant = new VoiceGrant({
        incomingAllow: true
    });
    token.addGrant(grant);
    let jwt = token.toJwt();
    let capability = new TaskRouterCapability({
        accountSid: accountSid, 
        authToken: authToken, 
        workspaceSid: workspaceSid, 
        channelId: workerSid});
    const workspacePolicies = [
        // Workspace fetch Policy
        buildWorkspacePolicy(),
        // Workspace subresources fetch Policy
        buildWorkspacePolicy({ resources: ['**'] }),
        // Workspace Activities Update Policy
        // Workspace resources update Policy
        buildWorkspacePolicy({ resources: ['**'], method: 'POST' }),
        // Workspace resources delete Policy
        buildWorkspacePolicy({ resources: ['**'], method: 'DELETE' }),
        buildWorkspacePolicy({ resources: ['Activities'], method: 'POST' }),
        // Workspace Activities Worker Reserations Policy
        buildWorkspacePolicy({ resources: ['Workers', workerSid, 'Reservations', '**'], method: 'POST' }),
    ];
    const eventBridgePolicies = util.defaultEventBridgePolicies(accountSid, workerSid);
    const workerPolicies = util.defaultWorkerPolicies(version, workspaceSid, workerSid);
    eventBridgePolicies.concat(workerPolicies).concat(workspacePolicies).forEach(function (policy) {
        capability.addPolicy(policy);
    });
    let workerToken = capability.toJwt();
    res.json({jwt: workerToken});
});

app.get('/worker/activity/sids', function(req, res) {
    res.json({availableSid: process.env.TWILIO_ACTIVITY_AVAILABLE_SID,
        unavailableSid: process.env.TWILIO_ACTIVITY_UNAVAILABLE_SID,
    });
});

app.get('/workflow/sid', function(req,res) {
    res.json({workflowSid: process.env.TWILIO_WORKFLOW_SID});
});

app.get('/workspace/token', function(req, res) {
    let taskAttributes = req.body;
    console.log('task attributes = ', taskAttributes);
    const capability = new TaskRouterCapability({
        accountSid: accountSid,
        authToken: authToken,
        workspaceSid: workspaceSid,
        channelId: workspaceSid,
    });
    const workspacePolicies = [
        // Workspace Policy
        buildWorkspacePolicy(),
        // Workspace subresources fetch Policy
        buildWorkspacePolicy({ resources: ['**'] }),
        // Workspace resources update Policy
        buildWorkspacePolicy({ resources: ['**'], method: 'POST' }),
        // Workspace resources delete Policy
        buildWorkspacePolicy({ resources: ['**'], method: 'DELETE' }),
    ];
    const eventBridgePolicies = util.defaultEventBridgePolicies(accountSid, workspaceSid);
    eventBridgePolicies.concat(workspacePolicies).forEach(policy => {
        capability.addPolicy(policy);
    });
    const token = capability.toJwt();
    res.json({jwt: token});
});

var server = app.listen(8007, function () {
    console.log('Server is running on 8007...');
});

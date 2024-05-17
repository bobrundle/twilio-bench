
var express = require('express');
var app = express();

require('dotenv').config({path: __dirname + '/.env.local'});
const taskrouter = require('twilio').jwt.taskrouter;
const { AccessToken } = require('twilio').jwt;
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
const workerAliceSid = process.env.TWILIO_WORKER_ALICE_SID;
const workerBobSid = process.env.TWILIO_WORKER_BOB_SID;
const workerCarolSid = process.env.TWILIO_WORKER_CAROL_SID;
const workerDanSid = process.env.TWILIO_WORKER_DAN_SID;

app.use(express.static(__dirname));
app.use(express.static(__dirname + '/node_modules'));
app.get('/', function(req, res) {
    res.sendFile('./index.html', {root: __dirname });
});

function getWorkerSid(workerName) {
    switch(workerName) {
        case 'alice':
            return workerAliceSid;
        case 'bob':
            return workerBobSid;
        case 'carol':
            return workerCarolSid;
        case 'dan':
            return workerDanSid;
        default: 
            return '';
    }
}
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

console.log('in twili-call-bench.js');

var customers = [];

$(document).ready(async function() {
    console.log('in document ready');
    customers = await $.get('/customer/list');
    console.log('customers = ', customers);
    displayCustomers();
    initializeQueueTarget();
});

var queues = [];
async function initializeQueueTarget() {
    let queueTarget = $('#queue-target');
    queueTarget.empty().append('<option value="">Select Queue</option>');
    queues = await $.get('/queue/list');
    queues.forEach(function(queue) {
        queueTarget.append('<option value="' + queue.phoneNumber + '">' + queue.name + '</option>');
    });

}
function displayCustomers() {
    var senderList = $('#sender-list');
    senderList.empty();
    customers.forEach(function(customer) {
        let t = $('#sender-list-entry').clone().removeAttr('id');
        let r = t.find('.sender-list-entry');
        r.attr('data-customer-phone-number', customer.phoneNumber);
        r.attr('data-customer-name', customer.name);
        r.find('.customer-name').text(customer.name);
        r.find('.call-content').attr('value',customer.message);
        r.find('.customer-enable').attr('checked', customer.enable).next().toggleClass('active', customer.enable);
        senderList.append(t.html());
    });
}

function appendMessage(elem, message, empty = false) {
    if(empty) {
        elem.empty();
    }
    let ts = new Date();
    elem.append('<p>' + ts.toLocaleString() + ': ' + message + '</p>');
}

var callShowerCount = 0;
var callShowerTimer = null;
var callShowerStatus = 'stopped';
var deviceOptions = {
        logLevel: 1
};

function enableButtons() {
    $('#start').prop('disabled', callShowerStatus === 'running' || callShowerStatus === 'starting' || callShowerStatus === 'stopping');
    $('#stop').prop('disabled', callShowerStatus !== 'running');
}
$("#start").on('click', async function() {
    let frequency = Number($('#frequency').val());
    if(isNaN(frequency) || frequency <= 0 || frequency >= 1000) {
        appendMessage($('#call-operation-status'), 'Frequency must be greater than 0 and less than 1000');
        return;
    }
    let phoneNumber = $('#queue-target').val();
    if(phoneNumber === '') {
        appendMessage($('#call-operation-status'), 'Please select a queue');
        return;
    }
    var customerList = [];
    $('.sender-list-entry').each(function() {
        let enable = $(this).find('.customer-enable').prop('checked');
        let $status = $(this).find('.sender-status');
        if(enable) {
            let phoneNumber = $(this).attr('data-customer-phone-number');
            let customerName = $(this).attr('data-customer-name');
            let message = $(this).find('.call-content').val();
            customerList.push({phoneNumber: phoneNumber, customerName: customerName, message: message, selector: $status});
        }
    });
    appendMessage($('#call-operation-status'), 'Starting call shower, sending ' + frequency + ' messages/minute');
    callShowerStatus = 'starting';
    enableButtons();
    $.ajax(
        {
            url: '/call/shower/start',
            type: 'POST',
            data: JSON.stringify({frequency: frequency, phoneNumber: phoneNumber, customerList: customerList}),
            dataType: 'json',
            contentType: 'application/json',
        }).then(function(data) {
            callShowerStatus = 'running';
            enableButtons();
            appendMessage($('#call-operation-status'), 'Shower started.');
        }).catch(function(err) {
            callShowerStatus = 'stopped';
            enableButtons();
            appendMessage($('#call-operation-status'), 'Error calling out: ' + JSON.stringify(err));
        });
});

$("#stop").on('click', async function() {
    callShowerStatus = 'stopping';
    enableButtons();
    await $.post('/call/shower/stop').then(function(data) {
        callShowerStatus = 'stopped';
        enableButtons();
        appendMessage($('#call-operation-status'), 'Call shower stopped');
        clearInterval(callShowerTimer);
    }).catch(function(err) {
        callShowerStatus = 'stopped';
        enableButtons();
        appendMessage($('#call-operation-status'), 'Error stopping call shower: ' + JSON.stringify(err));
    });
    appendMessage($('#call-operation-status'), 'Stopping call shower');
});


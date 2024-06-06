console.log('in twilio-chat-bench.js');

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
        r.find('.text-content').attr('value',customer.message);
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

var chatShowerTimer = null;
var chatShowerStatus = 'stopped';

function enableButtons() {
    $('#start').prop('disabled', chatShowerStatus === 'stopped');
    $('#stop').prop('disabled', chatShowerStatus !== 'running');
}
$("#start").on('click', function() {
    let frequency = Number($('#frequency').val());
    if(isNaN(frequency) || frequency <= 0 || frequency >= 1000) {
        appendMessage($('#chat-operation-status'), 'Frequency must be greater than 0 and less than 1000');
        return;
    }
    let phoneNumber = $('#queue-target').val();
    if(phoneNumber === '') {
        appendMessage($('#chat-operation-status'), 'Please select a queue');
        return;
    }
    var customerList = [];
    $('.sender-list-entry').each(function() {
        let enable = $(this).find('.customer-enable').prop('checked');
        if(enable) {
            let phoneNumber = $(this).attr('data-customer-phone-number');
            let customerName = $(this).attr('data-customer-name');
            let message = $(this).find('.text-content').val();
            customerList.push({phoneNumber: phoneNumber, customerName: customerName, message: message});
        }
    });
    appendMessage($('#chat-operation-status'), 'Starting chat shower, sending ' + frequency + ' messages/minute');
    let $status = $('.sender-status');
    chatShowerStatus = 'starting';
    enableButtons();
    $.ajax(
        {
            url: '/chat/shower/start',
            type: 'POST',
            data: JSON.stringify({frequency: frequency, phoneNumber: phoneNumber, customerList: customerList}),
            dataType: 'json',
            contentType: 'application/json',
        }).then(function(data) {
            chatShowerStatus = 'running';
            enableButtons();
            appendMessage($status, 'Message sent');
        }).catch(function(err) {
            chatShowerStatus = 'stopped';
            enableButtons();
            appendMessage($status, 'Error sending message: ' + JSON.stringify(err));
        });
});

$("#stop").on('click', function() {
    chatShowerStatus = 'stopping';
    enableButtons();
    $.post('/chat/shower/stop').then(function(data) {
        chatShowerStatus = 'stopped';
        enableButtons();
        appendMessage($('#chat-operation-status'), 'Chat shower stopped');
    }).catch(function(err) {
        chatShowerStatus = 'stopped';
        enableButtons();
        appendMessage($('#chat-operation-status'), 'Error stopping chat shower: ' + JSON.stringify(err));
    });
    appendMessage($('#chat-operation-status'), 'Stopping chat shower');
});


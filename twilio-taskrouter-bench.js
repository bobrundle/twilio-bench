console.log('in twilio-taskrouter-bench.js');

var workers = [];
var workspace = null;
var sids = null;

$(document).ready(async function() {
    console.log('in document ready');
    sids = await $.get('/worker/activity/sids');
});

function appendMessage(elem, message, empty = false) {
    if(empty) {
        elem.empty();
    }
    elem.append('<p>' + message + '</p>');
}
$('.connect-worker').on('click', async function() {
    let workerName = $(this).data('worker-name');
    let statusMessage = $(this).next();
    appendMessage(statusMessage, 'workerName =' + workerName);
    let result = await $.get('/worker/token', {workerName: workerName});
    let worker = new Twilio.TaskRouter.Worker(result.jwt);
    worker.on('ready', () => {
        appendMessage(statusMessage, 'in worker ready');
    });
    worker.on('reservation.created', function(reservation) {
        let message = 'reservation created';
        appendMessage(statusMessage, message);
        console.log(message);
        console.log(reservation);
    });
    worker.on('reservation.recinded', function(reservation) {
        let message = 'reservation recinded';
        appendMessage(statusMessage, message);
        console.log(message);
        console.log(reservation);
    });
    worker.on('reservation.timeout', function(reservation) {
        let message = 'reservation timeout';
        appendMessage(statusMessage, message);
        console.log(message);
        console.log(reservation);
    });
    worker.on('reservation.accepted', function(reservation) {
        let message = 'reservation accepted';
        appendMessage(statusMessage, message);
        console.log(message);
        console.log(reservation);
    });
    worker.on('reservation.rejected', function(reservation) {
        let message = 'reservation rejected';
        appendMessage(statusMessage, message);
        console.log(message);
        console.log(reservation);
    });
    worker.on('reservation.canceled', function(reservation) {
        let message = 'reservation canceled';
        appendMessage(statusMessage, message);
        console.log(message);
        console.log(reservation);
    });
    worker.on('reservation.completed', function(reservation) {
        let message = 'reservation completed';
        appendMessage(statusMessage, message);
        console.log(message);
        console.log(reservation);
    });
    worker.on('reservation.wrapup', function(reservation) {
        let message = 'reservation wrapup';
        appendMessage(statusMessage, message);
        console.log(message);
        console.log(reservation);
    });
    worker.on('token.expired', function() {
        let message = 'worker token expired';
        appendMessage(statusMessage, message);
        console.log(message);
    });
    worker.on('error', function(error) {
        let message = `Twilio task router error event`;
        appendMessage(statusMessage, message);
        console.log(message);
    });
    workers[workerName] = worker;
    let sids = await $.get('/worker/activity/sids');
    worker.update('ActivitySid', sids.availableSid, function(error, worker) {
        if(error) {
            appendMessage(statusMessage, `error updating activity: (${error.code}) ${error.message}`);
        } else {
            appendMessage(statusMessage, `worker activity updated to ${worker.activityName}`);
        }
    });
});

$('.connect-workspace').on('click', async function() {
    let statusElem = $(this).next();
    statusElem.empty();
    let result = await $.get('/workspace/token');
    let workspaceToken = result.jwt;
    workspace = new Twilio.TaskRouter.Workspace(workspaceToken);
    workspace.on("ready", function(workspace) {
        appendMessage(statusElem, 'in ready');
        appendMessage(statusElem, workspace.sid) // 'WSxxx'
        appendMessage(statusElem, workspace.friendlyName) // 'Workspace 1'
        appendMessage(statusElem, workspace.prioritizeQueueOrder) // 'FIFO'
        appendMessage(statusElem, workspace.defaultActivityName) // 'Offline'
    });
});   

$('.create-task').on('click', async function() {
    let statusElem = $(this).next();
    let result = await $.get('/workflow/sid');
    let workflowSid = result.workflowSid;
    statusElem.empty();
    if(workspace) {
        workspace.tasks.create({
                WorkflowSid: workflowSid,
                Attributes: JSON.stringify({type: 'support', priority: 'high'})
            },
            function(error, task) {
                if(error) {
                    appendMessage(statusElem, `(${error.code}) ${error.message}`);
                } else {
                    appendMessage(statusElem, `task created: ${task.sid}`);
                }
            }
        );
    } else {
        statusElem.append('workspace not connected');
    }
});

function getWorkerStatusElem(workerName, reservationCount) {
    let html = "";
    html += `<div class="worker-status-elem"><label class="px-2 w-100 m-4">Worker: ${workerName}, Reservations: ${reservationCount}</label></div>`;
    return html;
}
function getReservationStatusElem(reservation) {
    let html = "";
    html += `<div class="reservation-status-elem"><label class="px-2 w-100">Sid: ${reservation.sid}, Worker: ${reservation.workerName}, Age: ${getElapsedTime(reservation.dateCreated)}, Status: ${reservation.reservationStatus}</label>`;
    if(reservation.reservationStatus == 'pending') {
        html += `<div class="btn-group w-100" role="group" aria-label="Reservation Actions">`
        html += `<button type="button" class="btn btn-success accept-reservation" value="${reservation.sid}" data-worker-name="${reservation.workerName}">Accept</button>`;
        html += `<button type="button" class="btn btn-danger reject-reservation" value="${reservation.sid}" data-worker-name="${reservation.workerName}">Reject</button>`;
        html += `</div>`;
    }
    html += `<div class="reservation-status"></div>`;
    html += `</div></div>`;
    return html;
}
function getTaskStatusElem(task) {
    let html = "";
    html += `<div class="task-status-elem"><label class="px-2 w-100">Sid: ${task.sid}, Age: ${niceDuration(task.age)}, Status: ${task.assignmentStatus}</label>`;
    html += `<div class="btn-group w-100" role="group" aria-label="Task Actions">`
    html += `<button type="button" class="btn btn-primary complete-task" value="${task.sid}">Complete</button>`;
    html += `<button type="button" class="btn btn-warning cancel-task" value="${task.sid}">Cancel</button>`;
    html += `<button type="button" class="btn btn-danger delete-task" value="${task.sid}">Delete</button>`;
    html += `</div>`;
    html += `<div class="task-status"></div>`;
    html += `</div></div>`;
    return html;
}
function getElapsedTime(date) {
    let now = new Date();
    let elapsed = now - date;
    return niceDuration(elapsed / 1000);
}

function niceDuration(seconds, zeroText = 'n/a')
{
    if(seconds != null) {
        let s = Math.abs(seconds);
        let sign = Math.sign(seconds);
        let m = s/60;
        let h = m/60;
        let d = h/24;
        if(d > 1) {
            return (sign * d.toFixed(1)) + 'd';
        } else if(h > 1) {
            return (sign * h.toFixed(1)) + 'h';
        } else if(m > 1) {
            return (sign * m.toFixed(0)) + 'm';
        } else if(s > 1) {
            return (sign * s.toFixed(0)) + 's';
        } else if(s == 0) {
            return zeroText;
        } else {
            return (sign * s.toFixed(3)) + 's';
        }
    } else {
        return zeroText;
    }
}
$(document).on('click', '.accept-reservation', async function() {
    let reservationSid = $(this).val();
    let workerName = $(this).data('worker-name');
    let worker = workers[workerName]
    let statusElem = $(this).closest('.reservation-status-elem').find('.reservation-status');
    if(worker) {
        let start = new Date();
        let reservations = worker.fetchReservations(function(error, reservations) {
            if(error) {
                appendMessage(statusElem, `error fetching reservations: (${error.code}) ${error.message}`);
            } else if(reservations.data.length == 0) {
                appendMessage(statusElem, `no reservations found for worker ${workerName}`);
            } else {
                reservations.data.forEach(reservation => {  
                    if(reservation.sid == reservationSid) {
                        reservation.accept(function(error, reservation) {
                            if(error) {
                                appendMessage(statusElem, `(${error.code}) ${error.message}`);
                            } else {
                                appendMessage(statusElem, `reservation accepted in ${getElapsedTime(start)}.`);
                            }
                        });
                    }
                });
            }
        }, {ReservationStatus: "pending"});
    }
});
$(document).on('click', '.reject-reservation', async function() {
    let reservationSid = $(this).val();
    let workerName = $(this).data('worker-name');
    let worker = workers[workerName]
    let statusElem = $(this).closest('.reservation-status-elem').find('.reservation-status');
    if(worker) {
        let start = new Date();
        let reservations = worker.fetchReservations(function(error, reservations) {
            if(error) {
                appendMessage(statusElem, `error fetching reservations: (${error.code}) ${error.message}`);
            } else if(reservations.data.length == 0) {
                appendMessage(statusElem, `no reservations found for worker ${workerName}`);
            } else {
                reservations.data.forEach(reservation => {  
                    if(reservation.sid == reservationSid) {
                        reservation.reject(sids.availableSid, function(error, reservation) {
                            if(error) {
                                appendMessage(statusElem, `(${error.code}) ${error.message}`);
                            } else {
                                appendMessage(statusElem, `reservation rejected in ${getElapsedTime(start)}.`);
                            }
                        });
                    }
                });
            }
        }, {ReservationStatus: "pending"});
    }
});
$(document).on('click', '.complete-task', async function() {
    let taskSid = $(this).val();
    let statusElem = $(this).closest('.task-status-elem').find('.task-status');
    if(workspace) {
        let start = new Date();
        workspace.tasks.update(taskSid, {
            AssignmentStatus: 'completed'
        }, function(error, task) {
            if(error) {
                appendMessage(statusElem, `(${error.code}) ${error.message}`);
            } else {
                appendMessage(statusElem, `task completed in ${getElapsedTime(start)}.`);
            }
        });
    } else {
        statusElem.append('workspace not connected');
    }
});

$(document).on('click', '.cancel-task', async function() {
    let taskSid = $(this).val();
    let statusElem = $(this).closest('.task-status-elem').find('.task-status');
    if(workspace) {
        let start = new Date();
        workspace.tasks.update(taskSid, {
            AssignmentStatus: 'canceled'
        }, function(error, task) {
            if(error) {
                appendMessage(statusElem, `(${error.code}) ${error.message}`);
            } else {
                appendMessage(statusElem, `task canceled in ${getElapsedTime(start)}.`);
            }
        });
    } else {
        statusElem.append('workspace not connected');
    }
});

$(document).on('click', '.delete-task', async function() {
    let taskSid = $(this).val();
    let statusElem = $(this).closest('.task-status-elem').find('.task-status');
    if(workspace) {
        let start = new Date();
        workspace.tasks.delete(taskSid, function(error) {
            if(error) {
                appendMessage(statusElem, `(${error.code}) ${error.message}`);
            } else {
                appendMessage(statusElem, `task deleted in ${getElapsedTime(start)}.`);
            }
        });
    } else {
        statusElem.append('workspace not connected');
    }
});

$('.list-tasks').on('click', async function() {
    let statusElem = $(this).next();
    statusElem.empty();
    if(workspace) {
        workspace.tasks.fetch({}, function(error, tasks) {
            if(error) {
                appendMessage(statusElem, `error fetching tasks: (${error.code}) ${error.message}`);
            } else {
                tasks.data.forEach(task => {
                    appendMessage(statusElem, getTaskStatusElem(task));
                });
            }
        });
    } else {
        statusElem.append('workspace not connected');
    }
});

$('.list-reservations').on('click', async function() {
    let statusElem = $(this).next();
    statusElem.empty();
    Object.keys(workers).forEach(workerName => {
        let worker = workers[workerName];
        worker.fetchReservations(function(error, reservations) {
            if(error) {
                appendMessage(statusElem, `error fetching reservations: (${error.code}) ${error.message}`);
            } else {
                appendMessage(statusElem, getWorkerStatusElem(workerName, reservations.data.length));
            }
            reservations.data.forEach(reservation => {
                appendMessage(statusElem, getReservationStatusElem(reservation));
            });
        }, {ReservationStatus: "pending"});
    });
});
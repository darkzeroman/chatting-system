// CONSTANTS
var REDIS_PORT = 6379,
    // REDIS_HOSTNAME = "chat-redis-two.zqgwjh.0001.usw2.cache.amazonaws.com",
    REDIS_HOSTNAME = "localhost",
    SECRET = 'node-express-redis-server',
    COOKIE_NAME = 'AWSELB';

var express = require('express'),
    app = express(),
    http = require('http').Server(app),
    io = require('socket.io')(http),
    redis = require('redis'),
    os = require('os'),
    request = require('request'),
    async = require('async'),
    jade = require('jade'),
    session = require('express-session'),
    RedisStore = require('connect-redis')(session),
    rClient = redis.createClient(REDIS_PORT, REDIS_HOSTNAME),
    sessionStore = new RedisStore({client: rClient}),
    cookieParser = require('cookie-parser')(SECRET),
    bodyParser = require('body-parser'),
    SessionSockets = require('session.socket.io'),
    sessionSockets = new SessionSockets(io, sessionStore, cookieParser, COOKIE_NAME);

var subClient = redis.createClient(REDIS_PORT, REDIS_HOSTNAME); //creates a new client 
var pubClient = redis.createClient(REDIS_PORT, REDIS_HOSTNAME); //creates a new client 

var serverIpAddress;

request('http://instance-data/latest/meta-data/public-ipv4', function (err, response, body) {
   if (!err && response.statusCode == 200) {
    serverIpAddress = body;
  }
});

app.use(cookieParser);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({store:sessionStore, name: COOKIE_NAME, secret:SECRET}));

subClient.on('connect', function () {
  subClient.subscribe('messages.all');
});

pubClient.on('connect', function() {
    console.log('connected');
});

app.get('/', function(req, res){
    var vars = {serverIpAddress: serverIpAddress};
    res.send(jade.renderFile('./views/index.jade', vars));
});

app.post('/login', function (req, res) {
    // Store user info in session after login.
    var userId = req.body.userId;

    pubClient.sismember('loggedInUsers', userId, function (err, reply) {
        if (err) {
            res.status(500).send('Gateway Error');
            return;
        }

        if (reply === 1) {
           res.status(400).send('Username Already Exists');
           return; 
        }

        pubClient.sadd('loggedInUsers', userId, function (err, reply) {
            if (err) {
                res.status(500).send('Gateway Error');
                return;
            }

            req.session.userId = req.body.userId;
            res.send(req.body);

        });
    });

});

subClient.on('message', function (channel, message) {
    if (channel.indexOf('messages.all') > -1) {
        io.emit('chat.message', JSON.parse(message));
    }
});

sessionSockets.on('connection', function (err, socket, session) {
    // Close socket if userId is not logged in
    if (err || typeof session === 'undefined' || typeof session.userId === 'undefined') {
        console.log('err: ', err);
        console.log('user not logged in - closing socket');
        socket.disconnect();
        return;
    }

    // Get info from session
    var userId = session.userId;

    socket.on('user-to-server-message', function (msg) {
        sendMessage(userId, msg, socket);
    });

    socket.on('disconnect', function () {
        pubClient.srem('loggedInUsers', userId);
    });

    sendMessage(userId, 'logged in', socket);
});

function sendMessage(userId, msg, socket) {
    if (!pubClient.connected || !subClient.connected) {
        socket.emit('chat.status', {status: 'error', msg: 'Cannot send message'});
        return;
    }

    pubClient.publish('messages.all', JSON.stringify({userId: userId, msg: msg}));
}

http.listen(process.env.PORT || 8888, function(){
  console.log('listening on *:', process.env.PORT || 8888);
});

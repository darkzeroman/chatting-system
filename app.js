// CONSTANTS
var port = 6379,
    hostname = "localhost",
    SECRET = 'node-express-redis-server',
    COOKIE_NAME = 'AWSELB';

var express = require('express'),
    app = express(),
    http = require('http').Server(app),
    io = require('socket.io')(http),
    redis = require('redis'),
    session = require('express-session'),
    connectRedis = require('connect-redis'),
    RedisStore = connectRedis(session),
    rClient = redis.createClient(port, hostname),
    sessionStore = new RedisStore({client: rClient}),
    cookieParser = require('cookie-parser')(SECRET),
    bodyParser = require('body-parser'),
    SessionSockets = require('session.socket.io'),
    sessionSockets = new SessionSockets(io, sessionStore, cookieParser, COOKIE_NAME);

var subClient = redis.createClient(port, hostname); //creates a new client 
var pubClient = redis.createClient(port, hostname); //creates a new client 

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
  res.sendFile(__dirname + '/index.html');
});

app.post('/login', function (req, res) {
    //store user info in session after login.
    req.session.userId = req.body.userId;
    console.log('user logging in: ', req.body);
    res.send(req.body);
});

sessionSockets.on('connection', function (err, socket, session) {
    //Close socket if userId is not logged in
    if (err || typeof session === 'undefined' || typeof session.userId === 'undefined') {
        console.log(err);
        console.log('user not logged in - closing socket');
        socket.disconnect();
        return;
      }

    //get info from session
    var userId = session.userId;

    socket.on('user-to-server-message', function (msg) {
      pubClient.publish('messages.all', JSON.stringify({userId: userId, msg: msg}));
    });

    subClient.on('message', function (channel, message) {
      if (channel.indexOf('messages.all') > -1) {
        socket.emit('chat.message', JSON.parse(message));
      }
    });

    socket.emit('chat.userStatusChange', {userId: userId, msg: 'logged in'});  
});

http.listen(process.env.PORT || 8888, function(){
  console.log('listening on *:', process.env.PORT || 8888);
});

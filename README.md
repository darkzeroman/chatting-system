# chat-example

This is the source code for a very simple chat example used for 
the [Getting Started](http://socket.io/get-started/chat/) guide 
of the Socket.IO website.

Please refer to it to learn how to run this application.

And also look at: [Redis Pub Sub](https://github.com/rajaraodv/redispubsub)

Some interesting parts

* Uses Redis for Pub/Sub
* Runs on Elastic Beanstalk (You need to do your own configuration)
* Distributed system that can survive if one server goes down
* Redis is used for Pub/Sub for the messages
* Printout of the server IP address is shown on page
* Client will automatically reconnect if server disconnects
* Uses session data to keep track of logged in user data
* Toastr for server updates

Not production ready at all, this was a project to learn!



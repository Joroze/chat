
const app = require('express')();
const fs = require('fs');
const cors = require('cors');
const R = require('ramda');

const server = process.env.NODE_ENV === 'development'
  ? require('http').createServer(app)
  : require('https').createServer({
    privateKey: fs.readFileSync('/etc/letsencrypt/live/chat.backend.joroze.com/privkey.pem', 'utf8'),
    certificate: fs.readFileSync('/etc/letsencrypt/live/chat.backend.joroze.com/cert.pem', 'utf8'),
    ca: fs.readFileSync('/etc/letsencrypt/live/chat.backend.joroze.com/chain.pem', 'utf8'),
  }, app);

const io = require('socket.io')(server);

process.on('uncaughtException', (err) => {
  console.error(`${(new Date()).toUTCString()} uncaughtException:`, err);
  process.exit(1);
});

global.io = io;

const bodyParser = require('body-parser');
const { getGeneralUserInfo } = require('./lib/utilities');
const socket = require('./socket')();

// const socket = require('./socket')();

// const chatRouter = require('./chat');
// const goodsRouter = require('./goods');
// const orderRouter = require('./order');
// const userRouter = require('./user');

// const cookieParser = require("cookie-parser");
// const jwt = require("jsonwebtoken");
// const jwtMiddleware = require('./jwtMiddleware');

// app.use(cookieParser());
app.use(cors());
app.use(bodyParser.json());

// app.use('/user', userRouter);
// app.use('/goods', goodsRouter);
// app.use('/order', orderRouter);
// app.use('/chat', chatRouter);

app.get('/', (req, res) => {
  res.json('Hello!');
});

app.get('/users', (req, res) => {
  res.json(R.map(getGeneralUserInfo, global.clients));
});

const port = 4001;

server.listen(port, () => {
  console.log(`Node server has started at port *:${port}`);
});

const geoip = require('geoip-lite');
const R = require('ramda');
const { getGeneralUserInfo } = require('./lib/utilities');

const clients = {};
global.clients = clients;

function serverMessage(text = '') {
  return {
    type: 'server',
    author: {
      id: 9999,
      username: 'Server',
      avatar: undefined,
    },
    text,
    timestamp: Date.now(),
  };
}

function message(user, text = '') {
  if (!user) {
    throw new Error('User parameter required!');
  }

  return {
    type: 'user',
    author: user,
    text,
    timestamp: Date.now(),
  };
}

async function getLocation(ipAddress) {
  const location = await new Promise((resolve => (process.env.NODE_ENV === 'development'
    ? resolve('localhost')
    : resolve(geoip.lookup(ipAddress)))
  ));

  return location;
}

module.exports = function socket() {
  const chat = global.io.of('/chat').on('connection', (clientSocket) => {
    const clientIpAddress = clientSocket.handshake.address;

    clients[clientSocket.id] = {
      id: clientSocket.id,
      username: 'Guest',
      isModerator: false,
      isAdmin: false,
      isAuthor: false,
      avatar: undefined,
      ipAddress: clientIpAddress,
    };

    let clientUser = clients[clientSocket.id];
    const numberOfClients = Object.keys(global.io.sockets.connected).length;

    chat.emit('user', getGeneralUserInfo(clientUser));
    chat.emit('message', serverMessage(`${clientUser.username} has connected.`));

    console.log(`A client has connected. (clientSocket ID: ${clientSocket.id}, IP: ${clientIpAddress})`);
    getLocation(clientIpAddress).then((value) => {
      console.log(`Connected client's location: ${JSON.stringify(value)}`);
    });
    console.log(`${numberOfClients} currently online.`);

    function updateUser(updatedUserData = {}, userId = clientSocket.id) {
      const { username } = updatedUserData;

      if (username && username.length > 50) {
        clientSocket.emit('message', serverMessage('A name can not consist of more than 50 characters.'));
        console.log(`${clientUser.username}-${clientUser.id} attempted to choose a name consisting of more than 50 characters.`);
        return;
      }

      const userToBeUpdated = clients[userId];
      const updatedUser = R.merge(userToBeUpdated, updatedUserData);
      clients[userId] = updatedUser;
      clientUser = updatedUser;

      chat.emit('user', getGeneralUserInfo(updatedUser));
    }

    clientSocket.on('user_details', (userId) => {
      if (!clientUser.isAdmin || (clients[userId].isAdmin && userId !== clientUser.id)) {
        clientSocket.emit('message', serverMessage('Unauthorized'));
        return;
      }

      const userToView = clients[userId];

      getLocation(userToView.ipAddress)
        .then((value) => {
          console.log(`Location: ${JSON.stringify(value)}`);
          clientSocket.emit('user', { ...userToView, location: value });
        })
        .catch((error) => {
          console.log(error);
          clientSocket.emit('user', userToView);
        });
    });
    // clientSocket.on('set_user', (userData, userId) => updateUser(userData, userId));
    clientSocket.on('disconnect_user', (socketId) => {
      if (!clientUser.isAdmin || clients[socketId].isAdmin || clientUser.id === socketId || (clientUser.isModerator && clients[socketId].isModerator)) {
        clientSocket.emit('message', serverMessage('Unauthorized'));
      } else if (!(socketId in clients) || !(socketId in chat.connected)) {
        clientSocket.emit('message', serverMessage('User is no longer online'));
      } else {
        const clientToBeKicked = clients[socketId] || chat.connected[socketId];
        chat.connected[socketId].disconnect();
        clientSocket.emit('message', serverMessage(`${clientToBeKicked.username} has been kicked.`));
        console.log(`${clientToBeKicked.username}-${clientToBeKicked.id} has been kicked.`);
      }
    });

    clientSocket.on('disconnect', (reason) => {
      if (clientSocket.id) {
        delete clients[clientSocket.id];
      }

      clientSocket.broadcast.emit('user_disconnect', clientUser);
      clientSocket.broadcast.emit('message', serverMessage(`${clientUser.username} has disconnected.`));

      console.log(`${clientUser.username}-${clientUser.id} has disconnected: ${reason}`);
    });

    clientSocket.on('message', (msg) => {
      console.log(`${clientUser.username}-${clientIpAddress} said: `, msg);

      if (msg === '/admin netflix') {
        console.log(`${clientUser.username}-${clientUser.id} is now an admin.`);
        if (!clientUser.isAdmin) {
          chat.emit('message', serverMessage(`${clientUser.username} is now an admin.`));
        } else {
          clientSocket.emit('message', serverMessage('You\'ve already been set as an admin role.'));
        }

        clientUser.isAdmin = true;
        clientUser.isModerator = true;
        chat.emit('user', getGeneralUserInfo(clientUser));
        return;
      }

      if (msg.includes('/name ')) {
        const prevName = clientUser.username;
        const newName = msg.split('/name ')[1];
        updateUser({ username: newName });

        console.log(`${prevName}-${clientUser.id} new name is ${clientUser.username}.`);
        chat.emit('message', serverMessage(`${prevName}'s new name is ${clientUser.username}.`));

        return;
      }

      if (msg.includes('curse')) {
        clientSocket.disconnect();
        clientSocket.broadcast.emit('message', serverMessage(`${clientUser.username} has been kicked for swearing`));
        console.log(`${clientUser.username}-${clientUser.id} has been disconnected for swearing`);
        return;
      }

      chat.emit('message', message(clientUser, msg));
    });
  });
};

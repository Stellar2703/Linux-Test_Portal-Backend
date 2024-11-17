const { Client } = require('ssh2');

const initiateSSHConnection = (config, socket) => {
  const sshClient = new Client();
  let isFirstBuffer = true; // Flag to track the first buffer

  sshClient
    .on('ready', () => {
      socket.emit('data', 'SSH connection established');
      sshClient.shell((err, stream) => {
        if (err) return socket.emit('data', `Error: ${err.message}`);

        stream
          .on('data', (data) => {
            // Skip the first buffer
            if (isFirstBuffer) {
              isFirstBuffer = false;
              return;
            }

            console.log(data.toString());
            socket.emit('data', data.toString());
          })
          .on('close', () => {
            sshClient.end();
            socket.emit('data', 'Connection closed');
          });

        socket.on('command', (command) => stream.write(command + '\n'));
      });
    })
    .on('error', (err) => socket.emit('data', `Connection error: ${err.message}`))
    .connect(config);
};

module.exports = { initiateSSHConnection };

const http = require('http');
const socketIo = require('socket.io');

const server = http.createServer();
const io = socketIo(server);

const { makeKey, checkWinner } = require('./utill');
const { createGame, getGame, updateGame } = require('./data/game');
const { createPlayer, getPlayer, removePlayer } = require('./data/players');

const PORT = process.env.PORT || 5000;

io.on('connection', socket => {

    // dis connect 
    socket.on('disconnect', () => {
        const player = getPlayer(socket.id)
        if (player) {
            removePlayer(player.id)
        }
    })

    // create Game
    socket.on('createGame', ({ name }) => {
        const gameId = makeKey();

        const player = createPlayer(socket.id, name, gameId, 'X');
        const game = createGame(gameId, player.id, null);

        socket.join(gameId);
        socket.emit('playerCreated', { player });
        socket.emit('gameUpdataed', { game });
    })

    // join Game
    socket.on('joinGame', ({ name, gameId }) => {
        // check game id
        const game = getGame(gameId)
        if (!game) {
            socket.emit('notification', { message: `Invalid game id` });
            return;
        }

        // check max player
        if (game.player2) {
            socket.emit('notification', { message: `game is full` });
        }
        
        // create player
        const player = createPlayer(socket.id, name, gameId, 'O');
        // Update the game
        game.player2 = player.id;
        game.status = 'playing';
        updateGame(game);

        socket.join(gameId);
        socket.emit('playerCreated', { player });
        socket.emit('gameUpdataed', { game });

        socket.broadcast.emit('gameUpdataed', { game })
        socket.broadcast.emit('notification', { message: `${name} has joinded the game` })

    })

    // move Mode
    socket.on('moveMode', data => {
        const { player, square, gameId } = data;
        // Get the game
        const game = getGame(gameId);
        // update the board
        const { playBord = [], playerTurn, player1, player2 } = game;
        playBord[square] = player.symbol;
        // update the player turn
        const nextTurnId = playerTurn === player1 ? player2 : player1;
        // update the game object
        game.playerTurn = nextTurnId;
        game.playBord = playBord;
        updateGame(game);

        // Brodcast game updated to everyone
        io.in(gameId).emit('gameUpdataed', { game });

        // check winning status or draw
        const hasMon = checkWinner(playBord);
        if (hasMon) {
            const winner = { ...hasMon, player }
            game.status = 'gameOver';
            io.in(gameId).emit('gameUpdataed', { game });
            io.in(gameId).emit('gameEnd', { winner });
            return;
        }

        // Draw
        const emptySquareIndex = playBord.findIndex(item => item === null)
        if (emptySquareIndex == -1) {
            game.status = 'gameOver';
            io.in(gameId).emit('gameUpdataed', { game });
            io.in(gameId).emit('gameEnd', { winner: null });
        }
    })

    // clear data 
    socket.on('clearData', (data) => {
        const { player, gameId } = data;
        const game = getGame(gameId);
        game.playerTurn = player.id;
        game.playBord = Array(9).fill(null);
        game.status = 'playing';
        game.winner = null;

        updateGame(game);
        io.in(gameId).emit('gameUpdataed', { game });
        io.in(gameId).emit('gameEnd', { winner: null });
    })

    // chat
    socket.on('message', data => {
        const { gameId } = data
        io.in(gameId).emit('new_msg', data)
    })

    socket.on('broad', data => {
        socket.broadcast.emit('new_broad', data)
    })
})

server.listen(PORT, () => {
    console.log(`server is ready to play on port ${PORT}`);
})
var express = require('express');
var router = express.Router();

var WebSocket = require('ws');
const wss = new WebSocket.Server({ port:3002 });

let gameState = {
    ball: { x: 400, y: 300, dx: 3, dy: 3, radius: 10 },
    paddle: { x: 350, width: 100, height: 10 },
    bricks: Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 8 }, (_, c) => ({ x: c * 75 + 30, y: r * 25 + 30, visible: true }))
    ),
};

wss.on('connection', (ws) => {
    console.log('New client connected');

    // 定期的にゲーム状態を送信
    const interval = setInterval(() => {
        gameState.ball.x += gameState.ball.dx;
        gameState.ball.y += gameState.ball.dy;

        // ボールと壁の衝突判定
        if (gameState.ball.x + gameState.ball.radius > 800 || gameState.ball.x - gameState.ball.radius < 0) {
            gameState.ball.dx *= -1;
        }
        if (gameState.ball.y - gameState.ball.radius < 0) {
            gameState.ball.dy *= -1;
        }
        if (gameState.ball.y + gameState.ball.radius > 600) {
            clearInterval(interval);
            ws.send(JSON.stringify({ type: 'gameOver' }));
            gameState.ball.dy *= -1;
            gameState.ball.y = 100;
            console.log('フリーズしないで！');
            return;
        }

        // ブロック衝突判定
        gameState.bricks.forEach((row) =>
            row.forEach((brick) => {
                if (
                    brick.visible &&
                    gameState.ball.x > brick.x &&
                    gameState.ball.x < brick.x + 75 &&
                    gameState.ball.y > brick.y &&
                    gameState.ball.y < brick.y + 20
                ) {
                    brick.visible = false;
                    gameState.ball.dy *= -1;
                }
            })
        );

        // パドルとの衝突
        if (
            gameState.ball.x > gameState.paddle.x &&
            gameState.ball.x < gameState.paddle.x + gameState.paddle.width &&
            gameState.ball.y + gameState.ball.radius > 590
        ) {
            gameState.ball.dy *= -1;
        }

        ws.send(JSON.stringify({ type: 'update', gameState }));
    }, 16); // ~60fps

    // クライアントからのパドル操作
    ws.on('message', (message) => {
        var  {direction}  = JSON.parse(message);
        console.log(direction);
        if (direction === 'left') gameState.paddle.x = Math.max(0, gameState.paddle.x - 10);
        if (direction === 'right') gameState.paddle.x = Math.min(800 - gameState.paddle.width, gameState.paddle.x + 10);
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        clearInterval(interval);
    });
});

/* GET home page. */
router.get('/', function(req, res, next) {
    var data={
        title: 'game',
        content: 'これはサンプルのコンテンツです。<br>this is sample content.'
    }
    res.render('game', data);
});

router.get('/hockey',function(req,res,next){
    res.render('hockey');
});

module.exports = router;

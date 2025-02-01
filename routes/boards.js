var express = require('express');
var router = express.Router();

const path = require('path');
const sqlite3 = require('sqlite3');
// プロジェクトのルートディレクトリを基準に絶対パスを作成
const dbPath = path.join(__dirname, '../private/mydb.db');
// データベースに接続
const db = new sqlite3.Database(dbPath);

//一度の表示されるメッセージの数
const pnum = 30;

//usersと連携
//referencesがあるとon delete cascadeでusersのidが消えるとaccountIdも消える。
//foreign keyがあるとaccountIdには存在するusersのidしか代入できなくなる
db.run(`
  CREATE TABLE IF NOT EXISTS boards(
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "message" TEXT,
      "accountId" integer,
      "createdAt" datetime default (datetime('now','+9 hours')),
      foreign key (accountId) references users(id) on delete cascade
  )
`);

/* GET home page. */
router.get('/', function (req, res, next) {
    res.redirect('/boards/0');
});

//ログインしてなかったらログインページに飛ばす
function check(req, res) {
    if (req.session.login == null) {
        console.log('セッション切れてるっぽいぜ:' + req.session.login);
        req.session.back = '/boards';
        res.redirect('/users/enter');
        return true;
    } else {
        return false;
    }
}
//ユーザー全員のメッセージを見る
router.get('/:page', (req, res, next) => {
    //ログインしてなかったらログインページに飛ばす
    if (check(req, res)) return;
    const pg = Number(req.params.page);
    db.serialize(() => {
        //joinでusersとboardsを合体させる
        var q = '\
        SELECT *\
        FROM boards \
        JOIN users ON users.id = boards.accountId \
        ORDER BY boards.createdAt DESC \
        LIMIT ? OFFSET ?\
        ';
        db.all(q, [pnum, pg * pnum], (err, brds) => {
            var data = {
                title: 'boards',
                login: req.session.login,
                content: brds,
                page: pg
            }
            console.error(err);
            //console.log(brds);
            res.render('boards/index', data);
        });
    });
});
//メッセージフォームの送信処理
router.post('/add', (req, res, next) => {
    if (check(req, res)) return;
    const actId = req.session.login.id;
    const msg = req.body.msg;
    db.serialize(() => {
        db.run('insert into boards (accountId,message) values (?,?)', actId, msg, (err) => {
            res.redirect('/boards');
        });
    });
});
//ユーザーの投稿を見る
router.get('/home/:user/:id/:page', (req, res, next) => {
    if (check(req, res)) return;
    //+を付けて数値にする
    const id = +req.params.id;
    const pg = +req.params.page;
    db.serialize(() => {
        var q = '\
        SELECT * \
        FROM boards \
        JOIN users ON boards.accountId = users.id \
        WHERE boards.accountId = ? \
        ORDER BY boards.createdAt DESC\
        LIMIT ? OFFSET ? \
        ';
        db.all(q, [id, pnum, pg * pnum], (err, brds) => {
            var data = {
                title: 'boards',
                login: req.session.login,
                userName: req.params.user,
                accountId: id,
                content: brds,
                page: pg
            }
            res.render('boards/home', data);
        });
    });
});

module.exports = router;

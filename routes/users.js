var express = require('express');
var router = express.Router();

const path = require('path');
const sqlite3 = require('sqlite3');
// プロジェクトのルートディレクトリを基準に絶対パスを作成
const dbPath = path.join(__dirname, '../private/mydb.db');
// データベースに接続
const db = new sqlite3.Database(dbPath);

db.run(`
  CREATE TABLE IF NOT EXISTS users (
      "id" INTEGER unique,
      "name" TEXT not null unique,
      "pass" TEXT,
      PRIMARY KEY("id" AUTOINCREMENT)
  )
`);

/* GET users listing. */
router.get('/', function (req, res, next) {
  res.send('respond with a resource');
});


router.get('/enter', (req, res, next) => {
  var data = {
    title: 'Enter',
    content: 'ログインまたは新規登録ができます。',
    form: { name: '', pass: '' }
  }
  res.render('users/enter', data);
});

//新規登録とログイン。一緒にしないほうが良かった？
router.post('/enter', (req, res, next) => {
  const action = req.body.action;
  const nm = req.body.name;
  const ps = req.body.pass;
  switch (action) {
    case "add":
      db.run('insert into users (name,pass) values (?,?)', [nm, ps], (err) => {
        if (err) {
          var data = {
            title: '登録エラー',
            content: 'このユーザーネームはすでに登録されています。',
            form: req.body
          }
          //console.error(err);
        } else {
          //登録完了
          var data = {
            title: '登録完了',
            content: 'ようこそ' + nm + 'さん、下記からログインできます。',
            form: req.body
          }
        }
        res.render('users/enter', data);
      });
      break;
    case "login":
      db.serialize(() => {
        var q = 'select * from users where name = ? and pass = ?';
        db.get(q, [nm, ps], (err, row) => {
          if (!err && row != null) {
            //ログイン成功
            //セッションに名前やパスを保存
            req.session.login = row;
            var back = req.session.back;
            if (back == null) {
              back = '/';
            }
            //console.log(row,nm,ps);
            res.redirect(back);
          } else {
            var data = {
              title: 'ログインエラー',
              content: '間違いがあります。入力し直してください。',
              form: req.body
            }
            res.render('users/enter', data);
          }
        });
      });
      break;
  }
});


module.exports = router;

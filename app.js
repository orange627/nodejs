var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');


var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var helloRouter = require('./routes/hello');
var gameRouter = require('./routes/game');
var boardsRouter = require('./routes/boards');
var gomokuRouter = require('./routes/gomoku');
var kazuateRouter = require('./routes/kazuate');
var imageRouter = require('./routes/image');
const session = require('express-session');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

var session_opt = {
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7*24*60 * 60 * 1000 }//1週間有効
}
app.use(session(session_opt));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
// /helloにアクセスしたときにroutes/hello.jsを読み込む
//helloはユーザーによるsql操作を含むため非公開
//app.use('/hello', helloRouter);
//app.use('/game', gameRouter);
app.use('/gomoku', gomokuRouter);
app.use('/kazuate', kazuateRouter);
app.use('/boards', boardsRouter);
app.use('/image', imageRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;

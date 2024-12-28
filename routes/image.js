var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
    res.render('image/index',{});
});

module.exports = router;

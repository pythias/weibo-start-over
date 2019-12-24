// 1. 使用 chrome 打开 weibo.com （确保你登录了微博）
// 2. 打开调试窗口，在 console 中贴下面的代码后回车
// 3. 如需删除其他微博，请输入一下内容后回车：start(); 

var mids = [];
var midIndex = 0;
var timer = null;
var running = false;
var http = new XMLHttpRequest();

function cleanNextPage() {
    let url = 'https://weibo.com/p/' + $CONFIG['page_id'] + '/home';
    http.open('GET', url, true);
    http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    http.send();
    http.onreadystatechange = function() {
        if (http.readyState != 4 || http.status != 200) {
            return;
        }

        let matches = http.responseText.match(/mid=([0-9]+)/g);
        if (matches == null) {
            stop('恭喜你，可以重新来过了。如果还有请再执行一遍 ');
            return;
        }
        
        let values = {};
        matches.forEach(function(match) {
            values[match.substr(4)] = 0;
        }, this);

        mids = Object.keys(values);
        timer = setInterval('deleteNextWeibo();', 1000);

        console.log('本页有 ' + mids.length + ' 条微博');
    }
}

function deleteNextWeibo() {
    if (midIndex >= mids.length) {
        mids = [];
        midIndex = 0;
        clearInterval(timer);
        setTimeout('cleanNextPage();', 1000);
        return;
    }

    deleteWeibo(mids[midIndex]);
    midIndex++;
}

function deleteWeibo(mid) {
    http.open('POST', 'https://weibo.com/aj/mblog/del?ajwvr=6', true);
    http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    http.send('mid=' + mid);
    http.onreadystatechange = function() {
        if (http.readyState != 4 || http.status != 200) {
            return;
        }

        let json = {}
        try {
            json = JSON.parse(http.responseText);
        } catch (error) {
            return;
        }

        if (json.code == 100000) {
            console.log('删除成功 - ' + mid);
        }
    }
}

function stop(message) {
    clearInterval(timer);
    running = false;
    console.log(message);
}

function start() {
    if (running) {
        console.log('进行中...');
        return;
    }

    console.log('开始删除');
    running = true;
    mids = [];
    midIndex = 0;
    cleanNextPage();
}

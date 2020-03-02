var cleanup = {
    mids: [],
    midIndex: 0,
    timer: null,
    running: false,

    cleanNextPage: function() {
        let url = 'https://weibo.com/p/' + $CONFIG['page_id'] + '/home';
        http = new XMLHttpRequest();
        http.open('GET', url, true);
        http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        http.send();
        http.onreadystatechange = function() {
            if (http.readyState != 4 || http.status != 200) {
                return;
            }

            let matches = http.responseText.match(/mid=([0-9]+)/g);
            if (matches == null) {
                cleanup.stop("恭喜你！\n如有漏网，请再执行一遍");
                return;
            }
            
            let values = {};
            matches.forEach(function(match) {
                values[match.substr(4)] = 0;
            }, this);

            cleanup.mids = Object.keys(values);
            cleanup.timer = setInterval('cleanup.deleteNextWeibo();', 1000);

            console.log('即将清理 ' + cleanup.mids.length + ' 条微博');
        }
    },

    deleteNextWeibo: function() {
        if (cleanup.midIndex >= cleanup.mids.length) {
            cleanup.mids = [];
            cleanup.midIndex = 0;
            clearInterval(cleanup.timer);
            setTimeout('cleanup.cleanNextPage();', 1000);
            return;
        }

        cleanup.deleteWeibo(cleanup.mids[cleanup.midIndex]);
        cleanup.midIndex++;
    },

    deleteWeibo: function(mid) {
        http = new XMLHttpRequest();
        http.open('POST', 'https://weibo.com/aj/mblog/del?ajwvr=6', true);
        http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        http.send('mid=' + mid);
        http.onreadystatechange = function() {
            if (http.readyState != 4 || http.status != 200) {
                return;
            }

            try {
                const json = JSON.parse(http.responseText);
                if (json.code == 100000) {
                    console.log('清理 [' + mid + ']');
                }
            } catch (error) {
                return;
            }
        }
    },

    stop: function(message) {
        clearInterval(cleanup.timer);
        cleanup.running = false;
        console.log(message);
    },

    start: function() {
        if (cleanup.running) {
            console.log('正在进行中, 请稍后或者刷新页面后再执行.');
            return;
        }

        console.log("微博重头来过v1.0.0\n开始执行");
        cleanup.running = true;
        cleanup.mids = [];
        cleanup.midIndex = 0;
        cleanup.cleanNextPage();
    },
}


function cleanup() {
    this.reset();
}

cleanup.prototype.reset = function() {
    this.running = false;
    this.mids = [];
    this.midIndex = 0;
    if (this.timer) {
        clearInterval(this.timer);
    }
};

cleanup.prototype.cleanNextPage = function() {
    this.reset();
    this.running = true;

    const url = 'https://weibo.com/ajax/statuses/mymblog?uid=' + $CONFIG.uid + '&page=1&feature=0';
    let http = new XMLHttpRequest();
    http.open('GET', url, true);
    http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    http.send();

    var _this = this;
    http.onreadystatechange = function() {
        if (http.readyState != 4 || http.status != 200) {
            return;
        }

        let json = JSON.parse(http.responseText);
        if (json === undefined || json.data === undefined || json.data.list === undefined) {
            console.log("无法获取到微博列表");
        }

        let statuses = json.data.list;
        if (statuses.length == 0) {
            _this.stop("恭喜你！如有漏网，请再执行一遍");
            return;
        }
        
        _this.statuses = {};
        statuses.forEach(function(status) {
            _this.statuses[status.id] = status;
        }, this);

        _this.mids = Object.keys(_this.statuses);
        _this.timer = setInterval(function() {
            _this.deleteNextWeibo();
        }, 1000);

        console.log('即将清理 %d 条微博', statuses.length);
    }
};

cleanup.prototype.deleteNextWeibo = function() {
    if (this.midIndex < this.mids.length) {
        this.deleteWeibo(this.mids[this.midIndex]);
        this.midIndex++;
        return;
    }

    clearInterval(this.timer);

    var _this = this;
    setTimeout(function () {
        _this.cleanNextPage();
    }, 1000);
};

cleanup.prototype.deleteWeibo = function(mid) {
    const status = this.statuses[mid];
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
                console.log("清理 %s，发布于'%s'，内容：'%s'", mid, status.created_at, status.text);
            }
        } catch (error) {
            return;
        }
    }
};

cleanup.prototype.stop = function(message) {
    console.log(message);
    this.running = false;
    clearInterval(this.timer);
};

cleanup.prototype.start = function() {
    if (this.running) {
        console.log('正在进行中，请稍后或者刷新页面后再执行.');
        return;
    }

    console.log(`
╭╮╭╮╭╮╱╱╱╭╮╱╱╱╱╱╭━━━╮╭╮╱╱╱╱╱╭╮╱╭━━━╮
┃┃┃┃┃┃╱╱╱┃┃╱╱╱╱╱┃╭━╮┣╯╰╮╱╱╱╭╯╰╮┃╭━╮┃
┃┃┃┃┃┣━━┳┫╰━┳━━╮┃╰━━╋╮╭╋━━┳┻╮╭╯┃┃╱┃┣╮╭┳━━┳━╮
┃╰╯╰╯┃┃━╋┫╭╮┃╭╮┃╰━━╮┃┃┃┃╭╮┃╭┫┃╱┃┃╱┃┃╰╯┃┃━┫╭╯
╰╮╭╮╭┫┃━┫┃╰╯┃╰╯┃┃╰━╯┃┃╰┫╭╮┃┃┃╰╮┃╰━╯┣╮╭┫┃━┫┃
╱╰╯╰╯╰━━┻┻━━┻━━╯╰━━━╯╰━┻╯╰┻╯╰━╯╰━━━╯╰╯╰━━┻╯  v1.2
`);
    console.log("开始执行");
    this.cleanNextPage();
};

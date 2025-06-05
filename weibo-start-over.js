// ==UserScript==
// @name         Weibo Start Over
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Clean up your Weibo posts.
// @author       You
// @match        https://weibo.com/*
// @grant        none
// ==/UserScript==

// Configuration constants
const WEIBO_API_BASE_URL_MYMBLog = 'https://weibo.com/ajax/statuses/mymblog';
const WEIBO_API_URL_DELETE = 'https://weibo.com/aj/mblog/del?ajwvr=6';
const WEIBO_API_URL_DESTROY_QUICK_FORWARD = 'https://weibo.com/ajax/statuses/destroy';
const MAX_RETRIES_DELETE = 3;
const RETRY_DELAY_MS_DELETE = 2000; // 2 seconds
const WEIBO_PAGE_PROCESS_DELAY_MS = 1000; // Delay before fetching next page of weibo
const WEIBO_DELETE_INTERVAL_MS = 1000; // Interval between deleting individual weibo posts

/**
 * Main class for Weibo cleanup functionality.
 * @constructor
 */
function cleanup() {
    this.reset(); // Initialize state
}

/**
 * Resets the state of the cleanup process.
 * Initializes/clears微博 IDs list, index, running status, and timers.
 */
cleanup.prototype.reset = function() {
    this.running = false; // Indicates if the cleanup process is active
    this.mids = [];       // Array to store Weibo post IDs (mids) for deletion
    this.midIndex = 0;    // Index for iterating through the mids array
    this.statuses = {};   // Object to store status details, keyed by mid

    if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
    }
};

/**
 * Fetches the next page of the user's Weibo posts and processes them.
 * If posts are found, it initiates their deletion.
 */
cleanup.prototype.cleanNextPage = function() {
    this.reset(); // Reset state before processing a new page
    this.running = true;

    // Construct the URL for fetching user's Weibo posts
    // $CONFIG.uid is a global variable available on Weibo pages
    const url = `${WEIBO_API_BASE_URL_MYMBLog}?uid=${$CONFIG.uid}&page=1&feature=0`;

    // Use an Immediately Invoked Function Expression (IIFE) to handle async operations
    (async () => {
        try {
            console.log("Fetching Weibo posts from:", url);
            const response = await fetch(url);

            if (!response.ok) {
                console.error(`Error fetching Weibo list: ${response.status} ${response.statusText}`);
                this.stop(`获取微博列表失败 (HTTP ${response.status})，请刷新页面后再试`);
                return;
            }
            const json = await response.json();

            if (!json || !json.data || !json.data.list) {
                console.log("无法获取到微博列表 (数据结构异常或空列表). Response:", json);
                this.stop("无法解析微博列表或列表为空，请刷新页面后再试");
                return;
            }

            const statuses = json.data.list;
            if (statuses.length === 0) {
                this.stop("恭喜你！当前页面没有微博了。如有遗漏，请再次执行。");
                return;
            }

            // Store status details and prepare their IDs for deletion
            this.statuses = {};
            statuses.forEach(status => {
                this.statuses[status.id] = status;
            });

            this.mids = Object.keys(this.statuses); // Get all Weibo IDs from the current page

            // Start deleting Weibo posts one by one at a set interval
            this.timer = setInterval(() => {
                this.deleteNextWeibo();
            }, WEIBO_DELETE_INTERVAL_MS);

            console.log(`即将清理 ${statuses.length} 条微博 from page.`);
        } catch (error) {
            console.error("Error in cleanNextPage during fetch or JSON parsing:", error);
            this.stop("清理过程中发生错误，请刷新页面后再试");
        }
    })();
};

cleanup.prototype.deleteNextWeibo = function() {
    // If there are still Weibo posts in the current list to be deleted
    if (this.midIndex < this.mids.length) {
        this.deleteWeibo(this.mids[this.midIndex]); // Delete the next Weibo post
        this.midIndex++; // Move to the next ID
        return;
    }

    // All Weibo posts from the current page have been processed
    clearInterval(this.timer);
    this.timer = null;
    console.log("Current page's Weibo posts processed. Fetching next page...");

    // Automatically fetch and clean the next page after a delay
    setTimeout(() => {
        this.cleanNextPage();
    }, WEIBO_PAGE_PROCESS_DELAY_MS);
};

/**
 * Deletes a single Weibo post by its ID (mid).
 * Implements a retry mechanism for failed deletions.
 * @param {string} mid - The ID of the Weibo post to delete.
 */
cleanup.prototype.deleteWeibo = async function(mid) {
    const status = this.statuses[mid]; // Get status details for logging
    if (!status) {
        console.error(`Status data for mid ${mid} not found. Skipping deletion.`);
        return;
    }

    let apiUrl = WEIBO_API_URL_DELETE; // Default API URL for standard posts
    let isQuickRepost = false;

    // Check if it's a "quick repost"
    if (Array.isArray(status.mblog_menus_new)) {
        for (const menuItem of status.mblog_menus_new) {
            if (menuItem && menuItem.type === 'mblog_menus_cancel_quick_forward') {
                isQuickRepost = true;
                apiUrl = WEIBO_API_URL_DESTROY_QUICK_FORWARD;
                break;
            }
        }
    }

    let headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
    };
    let body;
    const deleteTypeMessage = isQuickRepost ? "quick repost" : "standard post";
    let logMessageMidParam = mid; // For logging, keep original mid

    if (isQuickRepost) {
        apiUrl = WEIBO_API_URL_DESTROY_QUICK_FORWARD;
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({ id: mid });
        logMessageMidParam = `id: ${mid}`; // For logging
    } else {
        // apiUrl is already WEIBO_API_URL_DELETE by default
        // For standard deletion, keep using URLSearchParams
        const params = new URLSearchParams({ mid: mid });
        body = params.toString();
        logMessageMidParam = `mid: ${mid}`; // For logging
    }

    // Loop for retry attempts
    for (let attempt = 1; attempt <= MAX_RETRIES_DELETE; attempt++) {
        try {
            // Updated log to show which parameter is being used.
            console.log(`Attempt ${attempt}/${MAX_RETRIES_DELETE} to delete ${deleteTypeMessage} (${logMessageMidParam})`);
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: body
            });

            if (response.ok) {
                const json = await response.json();
                // Weibo API success code for deletion is typically 100000 or 'ok' in data for destroy
                // For WEIBO_API_URL_DESTROY_QUICK_FORWARD, success might be different (e.g., json.ok === 1 or json.data.result === true)
                // Let's assume 100000 works for both for now, or a generic truthy 'code' or 'ok' field.
                // A common pattern for 'destroy' endpoint is just a status code 200 and simple json like {code: 100000} or {ok: 1}
                if (json && (json.code === 100000 || json.ok === 1 || (json.data && json.data.result))) { // Check for json.data.result for destroy endpoint
                    console.log("Successfully deleted %s (%s), posted at '%s', content: '%s'",
                                deleteTypeMessage, logMessageMidParam, status.created_at, status.text.substring(0, 50) + (status.text.length > 50 ? "..." : ""));
                    return; // Successful deletion, exit the function
                } else {
                    // Log the actual response code or error from json if available
                    const apiErrorCode = json ? (json.code || (json.data ? json.data.msg : 'N/A')) : 'N/A';
                    console.warn(`Failed to delete ${deleteTypeMessage} (%s) (API response not OK: ${apiErrorCode}). Attempt ${attempt}/${MAX_RETRIES_DELETE}. Response:`, logMessageMidParam, json);
                }
            } else {
                console.warn(`Failed to delete ${deleteTypeMessage} (%s) (HTTP ${response.status} ${response.statusText}). Attempt ${attempt}/${MAX_RETRIES_DELETE}.`, logMessageMidParam);
            }
        } catch (error) {
            // Catch network errors or other issues with the fetch call
            console.warn(`Error during deletion of ${deleteTypeMessage} (%s) (Attempt ${attempt}/${MAX_RETRIES_DELETE}):`, logMessageMidParam, error);
        }

        // If this attempt failed and it's not the last attempt, wait before retrying
        if (attempt < MAX_RETRIES_DELETE) {
            console.log(`Retrying deletion of ${deleteTypeMessage} (%s) in ${RETRY_DELAY_MS_DELETE / 1000}s...`, logMessageMidParam);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS_DELETE));
        } else {
            console.error(`Failed to delete ${deleteTypeMessage} (%s) after ${MAX_RETRIES_DELETE} attempts. Giving up on this Weibo.`, logMessageMidParam);
        }
    }
};

/**
 * Stops the cleanup process and clears any active timers.
 * @param {string} message - The message to log when stopping.
 */
cleanup.prototype.stop = function(message) {
    console.log(message);
    this.running = false;
    if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
    }
};

/**
 * Starts the Weibo cleanup process.
 * Displays a starting message and initiates the cleaning of the first page.
 */
cleanup.prototype.start = function() {
    if (this.running) {
        console.warn('Cleanup process is already running. Please wait or refresh the page to start over.');
        return;
    }

    console.log(`
WEIBO START OVER - v1.3
=========================
Initiating cleanup process...
╭╮╭╮╭╮╱╱╱╭╮╱╱╱╱╱╭━━━╮╭╮╱╱╱╱╱╭╮╱╭━━━╮
┃┃┃┃┃┃╱╱╱┃┃╱╱╱╱╱┃╭━╮┣╯╰╮╱╱╱╭╯╰╮┃╭━╮┃
┃┃┃┃┃┣━━┳┫╰━┳━━╮┃╰━━╋╮╭╋━━┳┻╮╭╯┃┃╱┃┣╮╭┳━━┳━╮
┃╰╯╰╯┃┃━╋┫╭╮┃╭╮┃╰━━╮┃┃┃┃╭╮┃╭┫┃╱┃┃╱┃┃╰╯┃┃━┫╭╯
╰╮╭╮╭┫┃━┫┃╰╯┃╰╯┃┃╰━╯┃┃╰┫╭╮┃┃┃╰╮┃╰━╯┣╮╭┫┃━┫┃
╱╰╯╰╯╰━━┻┻━━┻━━╯╰━━━╯╰━┻╯╰┻╯╰━╯╰━━━╯╰╯╰━━┻╯
`);
    console.log("开始执行 Weibo 清理...");
    this.cleanNextPage(); // Start by cleaning the first page
};

// Example of how to start the process (optional, could be triggered by a button in a real UserScript)
// const weiboCleaner = new cleanup();
// weiboCleaner.start();

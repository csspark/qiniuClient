import cos from 'qiniu';
import * as Constants from '../service/constants';
import QiniuBucket from "@/cos/qiniuBucket";

const methods = {
    //列举账号的所有空间
    buckets: 'https://rs.qbox.me/buckets',
    //获取一个空间绑定的域名列表
    getDomains: 'https://api.qiniu.com/v6/domain/list',
    //获取目录(是通过公共前缀模拟出的效果)
    getResources: 'https://rsf.qbox.me/list',
};

function init(param) {
    cos.conf.ACCESS_KEY = param.access_key;
    cos.conf.SECRET_KEY = param.secret_key;
    // qiniu.conf.BLOCK_SIZE = 512 * 1024;
    cos.conf.RPC_TIMEOUT = 180000;
}

function getToken() {
    return new cos.auth.digest.Mac(cos.conf.ACCESS_KEY, cos.conf.SECRET_KEY);
}

/**
 * http请求鉴权
 * @param url
 * @returns {*}
 */
function httpAuthorization(url) {
    return cos.util.generateAccessToken(getToken(), url, null);
}

function getQiniuUrl(domain, key) {
    return Constants.protocol + domain + '/' + encodeURI(key);
}

function getPrivateUrl(domain, key, deadline) {
    let config = new cos.conf.Config();
    let bucketManager = new cos.rs.BucketManager(getToken(), config);

    deadline = parseInt(Date.now() / 1000) + deadline;

    return bucketManager.privateDownloadUrl(Constants.protocol + domain, key, deadline);
}

/**
 * 通过url抓取文件
 */
function fetch(params, callback) {
    let config = new cos.conf.Config();
    let bucketManager = new cos.rs.BucketManager(getToken(), config);

    bucketManager.fetch(params.path, params.bucket, params.key, function (respErr, respBody, respInfo) {
        if (respBody.error) {
            respErr = {"error": respBody.error, 'status': respBody.status};
        }
        callback(respErr, respBody);
    });
}

/**
 * 上传文件
 * @param params
 * @param callback
 */
function upload(params, callback) {
    let options = {
        scope: params.bucket,
    };
    let putPolicy = new cos.rs.PutPolicy(options);
    let uploadToken = putPolicy.uploadToken(getToken());

    let config = new cos.conf.Config();

    let resumeUploader = new cos.resume_up.ResumeUploader(config);
    let putExtra = new cos.resume_up.PutExtra();
    putExtra.progressCallback = (uploadBytes, totalBytes) => {
        if (params.progressCallback) {
            params.progressCallback(parseInt((uploadBytes / totalBytes * 10000)) / 100);
        }
    };

    resumeUploader.putFile(uploadToken, params.key, params.path, putExtra, function (respErr, respBody, respInfo) {
        if (respBody.error) {
            respErr = {"error": respBody.error};
        }
        console.log(respErr, respBody, respInfo);
        callback(respErr, respBody);
    });
}

/**
 * 删除文件操作
 */
function remove(params, callback) {
    let config = new cos.conf.Config();
    let bucketManager = new cos.rs.BucketManager(getToken(), config);

    bucketManager.delete(params.bucket, params.key, function (err, respBody, respInfo) {
        console.log(respBody, respInfo);
        if (!err) {
            callback(respInfo);
        } else {
            console.log(err);
        }
    });
}

function generateBucket(name) {
    return new QiniuBucket(name);
}

export {init, httpAuthorization, getPrivateUrl, remove, upload, fetch, methods, generateBucket,};
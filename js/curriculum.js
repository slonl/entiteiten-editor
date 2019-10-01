/*

curriculum.loadContextFromURL('curriculum-inhouden','https://raw.githubusercontent.com/slonl/curriculum-inhouden/master/context.json')
.then(function(context) {
    return curriculum.loadData('curriculum-inhouden');
})
.then(function(data, errors) {

});

*/

var curriculum = (function(curriculum){

    curriculum.sources = {};

    curriculum.schemas = {};

    curriculum.index = {
        id: {},
        type: {},
        schema: {}
    };

    curriculum.data = {};

    curriculum.errors = [];

    curriculum.loadContextFromURL = function(name, url) {
        curriculum.sources[name] = {
            method: 'url',
            source: url,
            state: 'loading'
        };
        return fetch(url)
        .then(function(result) {
            if (result.ok) {
                curriculum.sources[name].state = 'parsing';
                return result.json();
            }
            throw new Error(result.statusText, result.status);
        })
        .then(function(json) {
            curriculum.schemas[name] = json;
            curriculum.sources[name].state = 'available';
            return json;
        });
    };

    curriculum.loadContextFromFile = function(name, fileName) {
        curriculum.sources[name] = {
            method: 'file',
            source: fileName,
            state: 'loading'
        };
        return new Promise(function(resolve, reject) {
            fs.readFile(
                fileName, 
                'utf8', 
                function(err, data) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                }
            );
        })
        .then(function(result) {
            return JSON.parse(result);
        })
        .then(function(json) {
            curriculum.schemas[name] = json;
            curriculum.sources[name].state = 'available';
            return json;
        });
    }

    curriculum.loadContextFromGithub = function(name, repository, user, password, branchName) {
		if (!branchName) {
			branchName = 'master';
		}
        curriculum.sources[name] = {
            method: 'github',
            source: repository,
			branch: branchName,
            state: 'loading'
        };
        var gh = new GitHub({username:user, password: password});
        var repoUser = repository.split('/')[0];
        var repoName = repository.split('/')[1];
        var repo, branch = null;
        var getFile = function(filename, list) {
            var nodes = filename.split('/');
            var node = nodes.shift();
            var entry = list.data.tree.filter(function(file) {
                return file.path == node;
            }).pop();
            hash = entry.sha;
            if (nodes.length) {
                return repo.getTree(hash).then(function(list) {
                    return getFile(nodes.join('/'), list);
                });
            } else {
                return repo.getBlob(hash).then(function(data) {
                    return data.data;
                });
            }
        };
        if (gh.getUser()) {
            var repo = gh.getRepo(repoUser, repoName);
            curriculum.sources[name].repo = repo;
            curriculum.sources[name].getFile = function(filename) {
                return new Promise(function(resolve, reject) {
                   fetch("https://raw.githubusercontent.com/" + repository + "/" + branchName + "/" + filename)
                    .then(function(response) {
                        return resolve(response.json());
                    });;
                });
            };

            curriculum.sources[name].writeFile = function(filename, data, message) {
                return repo.writeFile('master',filename,data,message,{encode:true});
            };
            curriculum.sources[name].writeFiles = function(files, message) {
                var blobs = [];
                var treeItems = [];
                Object.keys(files).forEach(function(filename) {
                    blobs.push(repo.createBlob(files[filename]).then(function(blob) {
                        treeItems.push({
                            path: filename,
                            sha: blob.sha,
                            mode: '100644',
                            type: 'blob'
                        });
                    }));
                });
                return Promise.all(blobs).then(function(blobs) {
                    repo.getBranch(branchName)
                    .then(function(branchOb) {
                        branch = branchOb;
                        return branch.data.commit.sha;
                    })
                    .then(function(lastCommit) {
                        //FIXME: should keep track of commit that was loaded, if lastCommit is differen
                        //we may need to merge first
                        repo.createTree(treeItems, lastCommit)
                        .then(function(tree) {
                            return repo.commit(lastCommit, tree.sha, message);
                        });
                    });
                });
            };

            return curriculum.sources[name].getFile('context.json')
            .then(function(json) {
                curriculum.schemas[name] = json;
                curriculum.sources[name].state = 'available';
                return json;
            });
        } else {
            return Promise.reject({ message: 'Access denied', code: 401});
        }
    };

    curriculum.loadData = function(name) {
        var schema = curriculum.schemas[name];
        var data = {};

        var properties = Object.keys(schema.properties);
        properties.forEach(function(propertyName) {
            if (typeof(schema.properties[propertyName]['#file']) != 'undefined') {
                data[propertyName] = (function() {
                    switch(curriculum.sources[name].method) {
                        case 'url':
                            var baseURL = dirname(curriculum.sources[name].source);
                            return fetch(baseURL + schema.properties[propertyName]['#file'])
                            .then(function(result) {
                                if (result.ok) {
                                    return result.json();
                                }
                                throw new Error(result.statusText, result.status);
                            });
                        break;
                        case 'file':
                            var baseDir = dirname(curriculum.sources[name].source);
                            return new Promise(function(resolve,reject) {
                                fs.readFile(
                                    baseDir + schema.properties[propertyName]['#file'], 
                                    'utf8', 
                                    function(err, data) {
                                        if (err) {
                                            reject(err);
                                        } else {
                                            resolve(data);
                                        }
                                    }
                                );
                            })
                            .then(function(result) {
                                return JSON.parse(result);
                            });
                        break;
                        case 'github':
                            return curriculum.sources[name].getFile(schema.properties[propertyName]['#file']);
                        break;
                        default:
                            throw new Error('Unknown loading method '+curriculum.sources[name].method);
                        break;
                    }
                })();
            } else {
                data[propertyName] = null;
            }
        });

        return Promise.all(Object.values(data))
        .then(function(results) {
            Object.keys(data).forEach(function(propertyName) {
                data[propertyName].then(function(entities) {
                    if (!curriculum.data[propertyName]) {
                        curriculum.data[propertyName] = [];
                    }
                    Array.prototype.push.apply(curriculum.data[propertyName],entities);

                    entities.forEach(function(entity) {
                        if (entity.id) {
                            if (curriculum.index.id[entity.id]) {
                                curriculum.errors.push('Duplicate id in '+name+'.'+propertyName+': '+entity.id);
                            } else {
                                curriculum.index.id[entity.id] = entity;
                                curriculum.index.type[entity.id] = propertyName;
                                curriculum.index.schema[entity.id] = name;
                            }
                        }
                    });
                });
            });
            return data;
        });
    };

    curriculum.getSchemaFromType = function(type) {
        return Object.keys(curriculum.schemas).reduce(function(acc, schema) {
            if (typeof curriculum.schemas[schema].properties[type] != 'undefined') {
                return schema;
            }
            return acc;
        }, '');
    };

    curriculum.uuidv4 = function(options, buf, offset) {
        var i = buf && offset || 0;

        if (typeof(options) == 'string') {
            buf = options === 'binary' ? new Array(16) : null;
            options = null;
        }
        options = options || {};

        var rnds = options.random || (options.rng || rng)();

        // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
        rnds[6] = (rnds[6] & 0x0f) | 0x40;
        rnds[8] = (rnds[8] & 0x3f) | 0x80;

        // Copy bytes to buffer, if provided
        if (buf) {
            for (var ii = 0; ii < 16; ++ii) {
                buf[i + ii] = rnds[ii];
            }
        }

        return buf || bytesToUuid(rnds);
    }

    function dirname(path) {
        return path.replace(/\\/g,'/').replace(/\/[^\/]*$/, '/');;
    };

    var rng = (function() {
        if (typeof require != 'undefined') {
            var crypto = require('crypto');
        }
        if (crypto && crypto.randomBytes) {
            return function() {
                return crypto.randomBytes(16);
            }
        }
        var getRandomValues = (typeof(crypto) != 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto)) ||
                      (typeof(msCrypto) != 'undefined' && typeof window.msCrypto.getRandomValues == 'function' && msCrypto.getRandomValues.bind(msCrypto));

        if (getRandomValues) {
            // WHATWG crypto RNG - http://wiki.whatwg.org/wiki/Crypto
            var rnds8 = new Uint8Array(16); // eslint-disable-line no-undef

            return function() {
                getRandomValues(rnds8);
                return rnds8;
            };
        } else {
            // Math.random()-based (RNG)
            //
            // If all else fails, use Math.random().  It's fast, but is of unspecified
            // quality.
            var rnds = new Array(16);

            return function() {
                for (var i = 0, r; i < 16; i++) {
                    if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
                    rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
                }
                return rnds;
            };
        }
    })();

    var byteToHex = [];
    for (var i = 0; i < 256; ++i) {
        byteToHex[i] = (i + 0x100).toString(16).substr(1);
    }

    function bytesToUuid(buf, offset) {
        var i = offset || 0;
        var bth = byteToHex;
        // join used to fix memory issue caused by concatenation: https://bugs.chromium.org/p/v8/issues/detail?id=3175#c4
        return ([bth[buf[i++]], bth[buf[i++]], 
        bth[buf[i++]], bth[buf[i++]], '-',
        bth[buf[i++]], bth[buf[i++]], '-',
        bth[buf[i++]], bth[buf[i++]], '-',
        bth[buf[i++]], bth[buf[i++]], '-',
        bth[buf[i++]], bth[buf[i++]],
        bth[buf[i++]], bth[buf[i++]],
        bth[buf[i++]], bth[buf[i++]]]).join('');
    }

    return curriculum;
})(curriculum || {});
if (typeof module != 'undefined') {
    module.exports = curriculum;
}
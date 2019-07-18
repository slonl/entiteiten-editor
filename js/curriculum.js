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

    var dirname = function(path) {
        return path.replace(/\\/g,'/').replace(/\/[^\/]*$/, '/');;
    };

    return curriculum;
})(curriculum || {});
if (typeof module != 'undefined') {
    module.exports = curriculum;
}
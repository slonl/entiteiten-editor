
    var niveauIndex = [];
    var reverseNiveauIndex = {};

    var reverseDoelIndex = {};
    var hierarchies = {
        'doel': {
            'lpib_vakleergebied':['lpib_vakkern_id','doelniveau_id'],
            'lpib_vakkern':['lpib_vaksubkern_id','doelniveau_id'],
            'lpib_vaksubkern':['lpib_vakinhoud_id','doelniveau_id'],
            'lpib_vakinhoud':['doelniveau_id'],
            'doelniveau':['doel_id'] // ,'niveau_id']
        },
		'leerdoelenkaarten': {
			'ldk_vakleergebied': ['ldk_vakkern_id','doelniveau_id'],
            'ldk_vakkern':['ldk_vaksubkern_id','doelniveau_id'],
            'ldk_vaksubkern':['ldk_vakinhoud_id','doelniveau_id'],
            'ldk_vakinhoud':['doelniveau_id'],
            'ldk_vakbegrip':['doelniveau_id'],
            'doelniveau':['doel_id'] // ,'niveau_id']
		},
        'examenprogramma': {
            'examenprogramma':['examenprogramma_domein_id','examenprogramma_kop1_id'],
            'examenprogramma_domein':['examenprogramma_eindterm_id', 'examenprogramma_subdomein_id'],
            'examenprogramma_subdomein':['examenprogramma_eindterm_id'],
            'examenprogramma_kop1':['examenprogramma_kop2_id', 'examenprogramma_body_id'],
            'examenprogramma_kop2':['examenprogramma_kop3_id', 'examenprogramma_body_id'],
            'examenprogramma_kop3':['examenprogramma_kop4_id', 'examenprogramma_body_id'],
            'examenprogramma_kop4':['examenprogramma_body_id']
        },
        'examenprogramma_bg': {
            'examenprogramma_bg_profiel': ['examenprogramma_bg_kern','examenprogramma_bg_module','examenprogramma_bg_keuzevak'],
            'examenprogramma_bg_kern': ['examenprogramma_bg_kerndeel'],
            'examenprogramma_bg_kerndeel': ['examenprogramma_bg_globale_eindterm'],
            'examenprogramma_bg_module': ['examenprogramma_bg_deeltaak','examenprogramma_bg_moduletaak'],
            'examenprogramma_bg_deeltaak': ['examenprogramma_bg_globale_eindterm'],
            'examenprogramma_bg_keuzevak': ['examenprogramma_bg_deeltaak','examenprogramma_bg_keuzevaktaak']
        },
        'kerndoelen': {
            'kerndoel_domein' : ['kerndoel_id'],
            'kerndoel_vakleergebied' : ['kerndoel_uitstroomprofiel_id', 'kerndoel_id', 'kerndoel_domein_id']
        },
        'inhoudslijnen': {
        	'inh_vakleergebied': ['inh_inhoudslijn_id','doelniveau_id'],
        	'inh_inhoudslijn': ['inh_cluster_id','doelniveau_id'],
        	'inh_cluster': ['inh_subcluster_id','doelniveau_id'],
        	'inh_subcluster': ['doelniveau_id'],
        	'doelniveau': ['doel_id']
        },
        'referentiekader': {
            'ref_vakleergebied': ['ref_domein_id','doelniveau_id'],
            'ref_domein': ['ref_subdomein_id','doelniveau_id'],
            'ref_subdomein': ['ref_onderwerp_id','doelniveau_id'],
            'ref_onderwerp': ['ref_deelonderwerp_id','doelniveau_id'],
            'ref_tekstkenmerk': ['doelniveau_id'],
            'doelniveau': ['doel_id']
        }
    };
    function walk(hierarchy, node, parents, callback) {
        var hier = hierarchies[hierarchy];
        var type = node.section;
        callback(node, parents);
        var childParents = parents.slice();
        childParents.push(node);
        if (hier[type]) {
            hier[type].forEach(function(prop) {
                if (node[prop]) {
                    node[prop].forEach(function(childId) {
                        var child = curriculum.index.id[childId];
                        if (!child) {
//                            console.error('Missing child id: '+childId+' in '+prop, node);
                        } else {
                            walk(hierarchy, curriculum.index.id[childId], childParents, callback);
                        }
                    });
                }
            });
        }
    }

    var emptyEntity = function() {
        return {
            lpib_vakkern_id : [],
            lpib_vaksubkern_id : [],
            lpib_vakinhoud_id : [],
            ldk_vakkern_id: [],
            ldk_vaksubkern_id: [],
            ldk_vakinhoud_id: [],
            inh_inhoudslijn_id: [],
            inh_cluster_id:[],
            inh_subcluster_id:[],
            ref_domein_id: [],
            ref_subdomein_id: [],
            ref_onderwerp_id: [],
            ref_deelonderwerp_id: [],
            ref_tekstkenmerk_id: [],
            doelniveau_id : [],
            doel_id : [],
            niveau_id : [],
            section: '',
            id: 0,
            dirty: 0,
            deleted: 0
        };
    };
    
    var originalEntities = {}; // store to keep unchanged originals so we can revert with delete-change
    var treeviewSchemas = null;

    var entityEditor = simply.app({
        container: document.body,
        routes : {
            '#edit/:id' : function(params) {
                entityEditor.actions.showEntity(params.id);
                entityEditor.view.page = "edit";
                entityEditor.view.rootEntity = params.id;
                entityEditor.actions.hideTreeView();
                window.scrollTo(0,0);
            },
            '#edit/' : function(params) {
                // reset page;
                entityEditor.view.entity = emptyEntity();
                entityEditor.view.page = "edit";
                entityEditor.view.rootEntity = null;
                entityEditor.actions.hideTreeView();
                window.scrollTo(0,0);
            },
            '#new/' : function(params) {
                // reset page;
                entityEditor.view.entity = emptyEntity();
                entityEditor.view.page = "new";
                entityEditor.view.rootEntity = null;
                entityEditor.actions.hideTreeView();
                window.scrollTo(0,0);
            },
            '#multipleparents/' : function(params) {
                // reset page;
                entityEditor.view.entity = emptyEntity();
                entityEditor.view.page = "multipleparents";
                entityEditor.view.rootEntity = null;
                entityEditor.actions.hideTreeView();
                window.scrollTo(0,0);
            }
        },
        commands: {
            toggleAddRelation: function(el, value) {
                el.closest('.slo-treeview-title').nextElementSibling.querySelector('.slo-treeview-add-relation').classList.toggle('slo-hidden');
            },
            toggleRelation: function(el, value) {
                // remove this entity as a child from its tree parent
                var ids = value.split(':');
                var childId = ids[1];
                var parentId = ids[0];
                if (entityEditor.actions.toggleRelation(parentId, childId)) {
                    el.closest('.slo-treeview-title').classList.remove('slo-removed');
                } else {
                    el.closest('.slo-treeview-title').classList.add('slo-removed');
                }
            },
            showEntity: function(el, value) {
                var selected = Array.from(document.querySelectorAll('.slo-treeview-title.slo-selected'));
                if (selected.length) {
                    selected.forEach(function(el) {
                        el.classList.remove('slo-selected');
                    });
                }
                entityEditor.actions.showEntity(value);
                var selected = document.querySelector('.slo-treeview-title[data-simply-value="'+value+'"]');
                if (selected) {
                    selected.classList.add('slo-selected');
                }
            },
            logoff: function() {
            localStorage.removeItem('login');
            location.reload(true);
            },
            login: function(form, values) {
                document.body.dataset.loading="true";
                return entityEditor.actions.start(values.username, values.password)
                .then(function() {
                    document.body.dataset.loading="false";
                    document.getElementById('login').removeAttribute('open');
                    entityEditor.view['login-error'] = '';
                    if (values.savelogin) {
                        localStorage.setItem('login',JSON.stringify(values));
                    }
                    return true;
                })
                .then(function() {
                        if (typeof LogRocket != 'undefined') {
                            LogRocket.identify(values.username);
                        }
                    return true;
                })
                .catch(function(error) {
                    if (error.path=='/user') {
                        entityEditor.view['login-error'] = 'Github login mislukt';
                        document.body.dataset.loading="false";
                        return false;
                    } else {
                        document.getElementById('login').removeAttribute('open');
                        entityEditor.view['login-error'] = '';
                        if (values.savelogin) {
                            localStorage.setItem('login',JSON.stringify(values));
                        }
                        throw error;
                    }
                });
            },
            'toggleTree': function(el) {
                var context = getContextFromId(entityEditor.view.rootEntity);
                if (!entityEditor.view.schemas || !entityEditor.view.schemas.includes(context)) {
                    entityEditor.view.schemas = [context];
                }
                entityEditor.actions.renderTree(curriculum.index.id[entityEditor.view.rootEntity],entityEditor.view.niveau,entityEditor.view.schemas)
                .then(function(contexts) {
                    document.body.querySelector('.slo-treeview').classList.toggle('slo-hidden');
                    $('.slo-treeview-schemas').val(contexts);
                    treeviewSchemas.setValue(entityEditor.view.schemas);
                });
            },
            'export-tree': function(el) {
            	entityEditor.actions['export-tree'](curriculum.index.id[entityEditor.view.rootEntity],entityEditor.view.niveau,entityEditor.view.schemas);
            },
            'search': function(el) {
                var searchInput = el.parentElement.querySelector('input');
                var searchText = searchInput.value;
                searchInput.value = '';
                return entityEditor.actions.search(searchText);
            },
            'new': function(el) {
                simply.route.goto(document.location.pathname + '#new');
            },
            'multipleparents': function(el) {
                simply.route.goto(document.location.pathname + '#multipleparents');
            },
            'delete-relation' : function(el) {
                rememberScrollPosition();
                el.parentNode.parentNode.removeChild(el.parentNode);
            },
            'add-relation' : function(el) {
                var relationInput = el.parentNode.querySelector("input");
                var relationId = relationInput.value;
                var relation = el.getAttribute("data-slo-relation");
                if (entityEditor.view.entity[relation] == null) {
                    entityEditor.view.entity[relation] = [];
                }

                var exists = entityEditor.view.entity[relation].filter(function(id) {
                    return (''+id) == relationId;
                });
                if (!exists.length) {
                    if (curriculum.index.id[relationId]) {
                        rememberScrollPosition();
                        entityEditor.view.entity[relation].push(relationId);
                        // fix for a bug in simply edit where the list / binding gets broken somehow;
                        for (var i=0; i<entityEditor.view.entity._bindings_[relation].elements.length; i++) {
                            entityEditor.view.entity._bindings_[relation].bind(entityEditor.view.entity._bindings_[relation].elements[i]);
                        }
                        window.setTimeout(function() {
                            window.scrollPosition = undefined;
                        }, 350);
                        relationInput.value = '';
                    } else {
                        // add new entity first
                        entityEditor.actions.newEntityForm(relation, entityEditor.view.entity.id);

                    }
                }
            },
            'delete-change' : function(el) {
                // find the id of the entity;
                var id = el.closest('.slo-entiteit-change').querySelector("a").innerHTML;
                if (originalEntities[id]) {
                    var original = clone(originalEntities[id]);
                    delete originalEntities[id];
                       curriculum.index.id[id] = original;
                    //FIXME: update curriculum.data as well?
                } else {
                    delete curriculum.index.id[id];
                    if (entityEditor.view.entity && entityEditor.view.entity.id == id) {
                        entityEditor.view.entity = {};
                    }
                }
                
                el.parentNode.parentNode.removeChild(el.parentNode);
                entityEditor.view.changeCount = entityEditor.view.changes.length;
                localStorage.changes = JSON.stringify(entityEditor.view.changes);

                  if (entityEditor.view.rootEntity) {
                       var root = curriculum.index.id[entityEditor.view.rootEntity];
                    entityEditor.actions.renderTree(root, entityEditor.view.niveau, entityEditor.view.schemas);
                }
                
                // reload the page to show the changes;
                if (entityEditor.view.entity) {
                    var entityId = entityEditor.view.entity.id;
                    if (entityId == id) {
                        if (curriculum.index.id[id]) {
                            entityEditor.actions.showEntity(id);
                        } else if (entityEditor.view.rootEntity) {
                            entityEditor.actions.showEntity(entityEditor.view.rootEntity);
                        } else {
                            simply.route.goto(document.location.pathname + '#new/');
                        }
                    }                                    
                } else {
                    simply.route.goto(document.location.pathname + '#new/');
                }
            },
            'commit-changes' : function() {
                document.body.dataset.loading="true";
                entityEditor.actions['commit-changes'](entityEditor.view.changes, entityEditor.view.commitMessage)
                .then(function(done) {
                    done.sort((a,b)=>b-a).forEach(function(changeIndex) {
                        entityEditor.view.changes.splice(changeIndex, 1);
                    })
                    entityEditor.view.changeCount = entityEditor.view.changes.length;
                    localStorage.changes = JSON.stringify(entityEditor.view.changes);
                    entityEditor.view.commitMessage = '';
                    document.body.dataset.loading="false";
                })
                .then(function() {
                    if (entityEditor.view.rootEntity) {
                        var root = curriculum.index.id[entityEditor.view.rootEntity];
                        entityEditor.actions.renderTree(root, entityEditor.view.niveau, entityEditor.view.schemas);
                    }
                })
                .catch(function(error) {
                    document.body.dataset.loading="false";
                    alert(error);
                });
            },
            'save' : function() {
                if (!entityEditor.view.entity.id) {
                    entityEditor.view.entity.id = curriculum.uuidv4();
                }
                entityEditor.actions.save(clone(entityEditor.view.entity));
                   if (entityEditor.view.rootEntity) {
                       var root = curriculum.index.id[entityEditor.view.rootEntity];
                    entityEditor.actions.renderTree(root, entityEditor.view.niveau, entityEditor.view.schemas);
                }                
            },
            deprecate: function() {
                if (entityEditor.view.entity.id) {
                    if (confirm('Weet u zeker dat u deze entiteit wil verwijderen?')) {
                        var changedEntity = clone(entityEditor.view.entity);
                        changedEntity.deleted = 1;
                        entityEditor.actions.save(changedEntity);          
                    }
                }
            },
            filterNiveau: function(select, value) {
                var entity = clone(entityEditor.view.entity);
                entityEditor.view.niveau = value;
                entityEditor.actions.renderTree(entity, value, entityEditor.view.schemas);
            },
            filterSchemas: function(select, values) {
                var entity = clone(entityEditor.view.entity);
                entityEditor.view.schemas = values;
                entityEditor.actions.renderTree(entity, entityEditor.view.niveau, values);
            }
        },
        actions: {
            toggleRelation: function(parentId, childId) {
                // fetch entity
                var entity = clone(curriculum.index.id[parentId]);
                var childType = curriculum.index.type[childId];
                // update
                if (!entity[childType+'_id'] || entity[childType+'_id'].indexOf(childId)===-1) { // restore
                    entity[childType+'_id'].push(childId);
                    entity.children.push(childId);
                    // add to changes
                    entityEditor.actions.save(entity);
                    return true;
                } else { // remove
                    entity[childType+'_id'] = entity[childType+'_id'].filter(function(id) {
                        return id!=childId;
                    });
                    entity.children = entity.children.filter(function(id) {
                        return id!=childId;
                    });
                    // add to changes
                    entityEditor.actions.save(entity);
                    return false;
                }
            },
            hideTreeView: function() {
                var tree = document.querySelector('.slo-treeview');
                if (tree) {
                    tree.classList.add('slo-hidden');
                }
            },
            showEntity: function(id) {
                if (!entityEditor.view) {
                    window.setTimeout(function() {
                        entityEditor.actions.showEntity(id);
                    }, 500);
                    return;
                }
                entityEditor.view.entity = emptyEntity();
                if (curriculum.index.id[id]) {
                    entityEditor.view.entity = clone(curriculum.index.id[id]);
                    //show the edit entity form
                     if (typeof entityEditor.view.entity.dirty === "undefined") {
                           entityEditor.view.entity.dirty = 0;
                    }
                } else if (!document.body.dataset.loading) {
                    alert('Onbekend id '+id);
                }
            },
            newEntityForm: function(relation, parentId) {
                if (entityEditor.view.entity.parent) {
                    entityEditor.actions.save(clone(entityEditor.view.entity));
                }
                var entity = emptyEntity();
                entity.id = curriculum.uuidv4();
                entity.section = relation.substr(0, relation.length-3);
                entity.dirty = 0;
                entity.parent = parentId;
                //show the new entity form
                entityEditor.view.entity = entity;
            },
            'renderTree': function(entity, niveau=null, contexts=null) {
                document.body.dataset.loading="true";
                if (niveau) {
                    var niveauIndexData = niveauIndex.filter(function(niveauData) {
                        return niveauData.niveau_id == niveau;
                    }).pop();
                }
                var render = function(e,contexts,niveau=null,parent) {
                    if (!e) {
                        return '<span class="slo-treeview-title"><span class="slo-tag"></span>Missing</span>';
                    }
                    if (niveau && (!e.niveau_id || !e.niveau_id.length) && (!reverseNiveauIndex[e.id] || reverseNiveauIndex[e.id].indexOf(niveau)===-1)) {
                        if (!reverseNiveauIndex[e.id]) {
                            console.error('missing reverse niveau index for '+e.id);
                            console.log(e);
                        }
                        return '';
                    }
                    if (niveau && e.niveau_id && e.niveau_id.length && e.niveau_id.indexOf(niveau)===-1) {
                        return '';
                    }
                    var title = (e.prefix ? e.prefix + ' ' + e.title : (e.title ? e.title : e.id));
                    if (curriculum.index.type[e.id]=='doelniveau') {
                    	title = getDoelNiveauTitle(e);                    	
                    }
                    var result = '<span class="slo-treeview-title" data-simply-command="showEntity" data-simply-value="'+e.id+'" title="'+escapeQuotes(title)+'">';
                    if (parent) {
                        result += '<a class="slo-remove-button slo-button slo-button-naked';
                        result += '" data-simply-command="toggleRelation" data-simply-value="'+parent.id+':'+e.id+'">×</a>';
                    }
                    
                    result += '<span class="slo-tag">'+e.section+'</span><span class="slo-title">'+title+'</span></span>';
                    if (!contexts) {
                        contexts = [];
                        contexts.push(getContextFromId(e.id));
                    }
                    result += '<div class="slo-treeview-children">';
                    if (!e.children) {
                        e.children = [];
                    }
                    e.children.forEach(function(c) {
                        if (contexts.indexOf(getContextFromId(c))!=-1 && curriculum.index.type[c]!='vakleergebied') {
                            result += render(curriculum.index.id[c], contexts, niveau, e);
                        }
                    });
                    result += '</div>';
                    return result;
                };
                var tree = document.querySelector('.slo-treeview-tree');
                var treeHTML = render(entity, contexts, niveau);
                tree.innerHTML = treeHTML;
                document.body.dataset.loading="false";
                return Promise.resolve(contexts);
            },
            'export-tree': function(root, niveau, schemas) {
                document.body.dataset.loading="true";
                if (niveau) {
                    var niveauIndexData = niveauIndex.filter(function(niveauData) {
                        return niveauData.niveau_id == niveau;
                    }).pop();
                }
                var getContextFromId = function(id) {
                    var section = curriculum.index.type[id];
                    var context = Object.keys(curriculum.schemas).filter(function(schema) {
                        return typeof curriculum.schemas[schema].properties[section]!='undefined';
                    }).pop();
                    return context;
                };
	
                var json = [];
                
                var getLevels = function(niveaus) {
                	return (niveaus && niveaus.length ? niveaus.map(id => curriculum.index.id[id].title).join(',') : '');
                };
                
				var createRowObject = function(e, parent) {
					var row = {
						ID: e.id,
						ParentID: (parent ? parent.id : ''),
						Prefix: (e.prefix ? e.prefix : ''),
						Titel: e.title,
						Omschrijving: e.description,
						Type: curriculum.index.type[e.id]
					};
					if (row.Type=='doelniveau') {
						row.Levels = getLevels(e.niveau_id);
                    }
					var context = getContextFromId(e.id);
					var allprops = Object.keys(curriculum.schemas[context].properties[row.Type].items.properties);
					var ignore = ['id','prefix','title','description','children','parent','section','niveau_id'];
					allprops
					.filter(p => !ignore.includes(p))
					.filter(p => p.substr(-3)!='_id')
					.forEach(p => {
						if (typeof e[p] !== 'undefined') {
							row[p] = e[p];
						} else {
							row[p] = '';
						}
					});
					return row;
				};

                var exportTree = function(e,contexts,niveau,parent) {
                    if (!e) {
                        return; //FIXME: throw error? '<span class="slo-treeview-title"><span class="slo-tag"></span>Missing</span>';
                    }
                    if (niveau && !e.niveau_id && (!reverseNiveauIndex[e.id] || reverseNiveauIndex[e.id].indexOf(niveau)===-1)) {
                        if (!reverseNiveauIndex[e.id]) {
                            console.error('missing reverse niveau index for '+e.id);
                            console.log(e);
                        }
                        return;
                    }
                    if (niveau && e.niveau_id && e.niveau_id.indexOf(niveau)===-1) {
                        return;
                    }
					// add row for entity
					if (e.title) {
						json.push(createRowObject(e, parent));
					} else { //FIXME: check if this is a doelniveau	
						// TODO: for doelniveau use id, title and levels from doel
                        var children = [];
						if (e.children && e.children.length) {
							children = [...e.children];
						} else if (e.section == 'doelniveau') {
                            ['doel','kerndoel','examenprogramma_eindterm','examenprogramma_subdomein','examenprogramma_subdomein'].forEach(p => {
                                if (e[p+'_id']) {
                                    children = children.concat(e[p+'_id']);
                                }
                            });
                        }
                        if (children.length) {
                            // use the first child as parent instead of the doelniveau itself
                            // doelniveau's should never be included in the export excel
                            // by using a doelniveau child as parent, an entity will be added to that doelniveau as a child in the import tool
                            var first = children.shift();
                            if (!first.id) {
                                first = curriculum.index.id[first];
                            }
                            json.push(createRowObject(e, parent));
                            children.forEach(function(c) {
                                if (contexts.indexOf(getContextFromId(c))!=-1 && curriculum.index.type[c]!='vakleergebied') {
                                    exportTree(curriculum.index.id[c], contexts, niveau, first);
                                }
                            });
                            return;
                        }
					}
					 
                    if (!contexts) {
                        contexts = [];
                        contexts.push(getContextFromId(e.id));
                    }
                    if (e.children && e.children.length) {
                        e.children.forEach(function(c) {
                            if (contexts.indexOf(getContextFromId(c))!=-1 && curriculum.index.type[c]!='vakleergebied') {
                                exportTree(curriculum.index.id[c], contexts, niveau, e);
                            }
                        });
                    }
                };
                exportTree(root, schemas, niveau);
				var ws = XLSX.utils.json_to_sheet(json, {
					header: ["ID", "ParentID", "Prefix", "Titel", "Omschrijving", "Type", "Levels"]
				});
				ws['!cols'] = [
					{wch: 4},
					{wch: 4},
					{wch: 12},
					{wch: 60},
					{wch: 10},
					{wch: 10},
					{wch: 10}
				];
				ws.A4.s = {alignment:{ wrapText: true }}; // FIXME: this does nothing, upgrade to pro or user xlsx-style fork
				var wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Sheet 1");
				XLSX.writeFile(wb, 'export.xlsx'); //FIXME: use title from root entity
                document.body.dataset.loading="";
                return Promise.resolve(true);            	
            },
            'showLogin': function() {
                 document.getElementById('login').setAttribute('open','open');
                 entityEditor.view['login-error'] = '';
                 return Promise.resolve(true);
            },
            'autologin': function(username, password) {
                document.body.dataset.loading="true";
                return entityEditor.actions.start(username, password)
                .then(function() {
                    document.body.dataset.loading="false";
                    return true;
                })
                .then(function() {
                    if (typeof LogRocket != 'undefined') {
                        LogRocket.identify(username);
                    }                    
                    return true;
                })
                .catch(function(error) {
                    if (error.path == '/user') {
                        document.getElementById('login').setAttribute('open','open');
                        entityEditor.view['login-error'] = '';
                        document.body.dataset.loading="false";
                        return false;
                    } else {
                        document.getElementById('login').removeAttribute('open');
                        entityEditor.view['login-error'] = '';
                        throw error;
                    }
                });
            },
            'search': function(searchText) {
                  if (curriculum.index.id[searchText]) {
                      simply.route.goto(document.location.pathname + "#edit/" + searchText);
                  }
            },
            addChangedEntity: function(entity) {
                entityEditor.view.changes = entityEditor.view.changes.filter(function(entry) {
                    if (entity.id == entry.id) {
                        return false;
                    }
                    return true;
                });
                entityEditor.view.changes.push(clone(entity));
                if (curriculum.index.id[entity.id] && !originalEntities[entity.id]) {
                    // keep the unchanged version in case we need to revert
                    var original = curriculum.data[curriculum.index.type[entity.id]]
                        .filter(function(e) {return e.id == entity.id; })
                        .pop();
                    if (original) {
                        originalEntities[entity.id] = clone(original);
                    }
                }
                curriculum.index.id[entity.id] = entity;
                curriculum.index.type[entity.id] = entity.section;
                
                entityEditor.view.changeCount = entityEditor.view.changes.length;
                localStorage.changes = JSON.stringify(entityEditor.view.changes);    
            },
            save: function(entity) {
                if (entity.parent) {
                    var parent = clone(curriculum.index.id[entity.parent]);
                    if (parent) {
                        if (typeof parent[entity.section+'_id'] == 'undefined') {
                            parent[entity.section+'_id'] = [];
                        }
                        parent[entity.section+'_id'].push(entity.id);
                        parent.children.push(entity.id);
                        entityEditor.actions.addChangedEntity(parent);
                    }
                    delete entity.parent;
                }
                entityEditor.actions.addChangedEntity(entity);
            },
            'commit-changes': function(changes, message) {
                if (!message) {
                    return Promise.reject('Commit message required');
                }
                var done = [];
                var schemas = {};
                changes.forEach(function(change, changeIndex) {
                    if (!change.commit) {
                        return false;
                    }
                    var id = change.id;
                    var original = curriculum.data[curriculum.index.type[id]].find(function(entry) {
                        if (entry.id == id) {
                            return true;
                        }
                        return false;
                    });
//                    delete change.section;
//                    delete change.parents;
                    if (original) {
                        var index = curriculum.data[curriculum.index.type[id]].indexOf(original);
                        curriculum.data[curriculum.index.type[id]][index] = change;
                    } else {
                        curriculum.data[curriculum.index.type[id]].push(change);
                    }
                    var section = curriculum.index.type[change.id];
                    var schema = curriculum.getSchemaFromType(section);
                    if (!schemas[schema]) {
                        schemas[schema] = [];
                    }
                    if (schemas[schema].indexOf(section)===-1) {
                        schemas[schema].push(section);
                    }
                    done.push(changeIndex);
                });
                var clean = function(dataset) {
                    dataset = clone(dataset);
                    dataset.forEach(function(entity) {
                        delete entity.section;
                        delete entity.parents;
                        delete entity.children;
                        delete entity.commit;
                        if (!entity.dirty || entity.dirty==="0") {
                            delete entity.dirty;
                        }
                        if (!entity.deleted || entity.deleted==="0") {
                            delete entity.deleted;
                        }
                        Object.keys(entity).forEach(function(p) {
                            if (Array.isArray(entity[p]) && entity[p].length==0) {
                                delete entity[p];
                            }
                        });
                        //FIXME: remove any properties that aren't part of the schema
                        //except dirty and deleted?
                    });
                    return dataset;
                };
                var files = [];
                Object.keys(schemas).forEach(function(schema) {
                    schemas[schema].forEach(function(section) {
                        var filename = curriculum.schemas[schema].properties[section]['#file'];
                        files.push({ path: filename, data: JSON.stringify(clean(curriculum.data[section]), null, "\t"), schema: schema});
                    });
                });
                return new Promise(function(resolve, reject) {
                    var errors = {};
                    var writeFile = function() {
                        if (!files.length) {
                            if (Object.keys(errors).length) {
                                //FIXME: some changes may have been committed correctly...
                                return reject(errors);
                            } else {
                                return resolve(done);
                            }
                        }
                        var file = files.shift();
                        return curriculum.sources[file.schema].writeFile(file.path, file.data, message).then(writeFile);
                    }
                    return writeFile();
                }).then(function() {
                    // clear originals because revert is no longer an option
                    originalEntities = {};
                    return done;
                });
//              return curriculum.sources[schema].writeFiles(files, message);
            },
            filterNiveau: function(niveauId) {
                entityEditor.actions.renderTree(entityEditor.view.entityId,niveauId,entityEditor.view.schemas);
            },
            start: function(user, pass) {
                var schemas = {
                    'curriculum-lpib': 'slonl/curriculum-lpib',
                    'curriculum-basis': 'slonl/curriculum-basis',
                    'curriculum-kerndoelen': 'slonl/curriculum-kerndoelen',
                    'curriculum-examenprogramma': 'slonl/curriculum-examenprogramma',
                    'curriculum-examenprogramma-bg': 'slonl/curriculum-examenprogramma-bg',
                    'curriculum-syllabus': 'slonl/curriculum-syllabus',
                    'curriculum-doelgroepteksten': 'slonl/curriculum-doelgroepteksten',
                    'curriculum-leerdoelenkaarten': 'slonl/curriculum-leerdoelenkaarten',
					'curriculum-inhoudslijnen': 'slonl/curriculum-inhoudslijnen',
                    'curriculum-referentiekader': 'slonl/curriculum-referentiekader'
                };
                var branch = 'editor';
                var loading = [];
                var schemasParsed = {};
                Object.keys(schemas).forEach(function(schema) {
                    loading.push(
                        curriculum.loadContextFromGithub(schema, schemas[schema], user, pass, branch)
                        .then(function() {
                            return curriculum.loadData(schema);
                        })
                        .then(function() {
                            return curriculum.parseSchema(curriculum.schemas[schema]);
                        })
                        .then(function(parsed) {
                            schemasParsed[schema] = parsed;
                            return parsed;
                        })
                    );
                });

                // get user info
                // put it in the entityEditor.view.user
                // name and avatar_url
                var gh = new GitHub({username:user, password: pass});
                return gh.getUser().getProfile()
                .then(function(profile) {
                    entityEditor.view.user = profile.data;
                    document.body.classList.add('slo-logged-on');
                    return profile;
                })
                .then(function(profile) {
                    return Promise.all(loading)
                })
				// add datalist elements
				// add templates for each entity type
				.then(function() {
                    var ignore = ['id','replaces','replacedBy','dirty','unreleased'];
                    var datalists = [];
					Object.keys(schemasParsed).forEach(function(context) {
						Object.keys(schemasParsed[context].properties).forEach(function(section) {
							if (/deprecated/.exec(section)) {
								return;
							}
                            var list = document.createElement('datalist');
                            list.id = section;
                            list.dataset.simplyList = "dataset."+section;
                            list.dataset.simplyData = section;
                            list.dataset.simplyEntry = 'entry';
                            document.body.appendChild(list); // @NOTE: simply-edit requires a template in the list, but this is fixed by the datasource load method

                            datalists.push(section);

							var template = document.createElement('template');
							template.id = 'entiteit-'+section;
                            var html = '<div class="slo-entity">';
                            var sortOrder = {
                                prefix : '',
                                title : '',
                                description : '',
                                url : '',
                                ce_se : '',
                                kern_keuze : '',
                                vakleergebied_id : '',
                                niveau_id : ''
                            };
                            Object.keys(schemasParsed[context].properties[section].items.properties).forEach(prop => {
                                if (!ignore.includes(prop)) {
                                    var property = schemasParsed[context].properties[section].items.properties[prop];
                                    var replace = {
                                        'label'    : prop,
                                        'property' : 'entity.'+prop,
                                        'relation' : prop,
                                        'datalist' : prop.replace(/_id$/,'')
                                    };
                                    var t;
                                    switch (property.type) {
                                        case 'array':
                                            t = document.getElementById('slo-link-multiple').innerHTML;
                                        break;
                                        case 'string':
                                            if (/_id$/.exec(prop)) {
                                                t = document.getElementById('slo-link-singular').innerHTML;
                                            } else {
                                                t = document.getElementById('slo-string').innerHTML;
                                            }
                                        break;
                                        default: // e.g. array['string','null']
                                            if (property.enum) {
                                                t = document.getElementById('slo-string').innerHTML;
                                            } else {
                                                t = '<div class="unknown">'+prop+': '+JSON.stringify(property.type)+'</div>';
                                            }
                                        break;
                                    }
                                    Object.keys(replace).forEach(key => {
                                        t = t.replaceAll('{{'+key+'}}', replace[key])
                                    });
                                    sortOrder[prop] = t;
                                }
                            });
                            html += Object.values(sortOrder).join("\n");

                            html += '</div>';
							template.innerHTML = html;

							document.body.appendChild(template);
						});
					});
                    datalists.sort();
                    entityEditor.view.datalists = datalists;
					return true;
				})
                .then(function() {
                    Object.values(curriculum.index.id).forEach(function(entity) {
                        entity.section = curriculum.index.type[entity.id];
                        entity.children = [];
                        Object.keys(entity).forEach(function(prop) {
                            if (prop.substr(prop.length-3)=='_id' && prop!='niveau_id') {
                                entity.children = entity.children.concat(entity[prop]);
                            }
                        });
                    });

                    
                    var parentInfo = {
                        'lpib_vakleergebied' : 'doel',
                        'examenprogramma' : 'examenprogramma',
                        'kerndoel_vakleergebied': 'kerndoelen',
                        'examenprogramma_bg_profiel': 'examenprogramma_bg',
                    	'ldk_vakleergebied': 'leerdoelenkaarten',
                    	'inh_vakleergebied': 'inhoudslijnen',
                        'ref_vakleergebied': 'referentiekader'
                    };
                    Object.keys(parentInfo).forEach(function(section) {
                        curriculum.data[section].forEach(function(vakEntity) {
                            walk(parentInfo[section], vakEntity, [], function(entity, parents) {
                                if (!entity.parents) {
                                    entity.parents = [];
                                }
                                parents.map(function(parent) {
                                    if (parent.id) {
                                        return {
                                            id : clone(parent.id),
                                            type : clone(parent.section),
                                            ids : [{id : clone(parent.id)}]
                                        }
                                    }
                                })
                                .filter(Boolean)
                                .map(function(parent) {
                                    var add = true;
                                    entity.parents.forEach(function(item) {
                                        if (item.type == parent.type) {
                                            // check if the new parent already is in the ids list;
                                            var dups = item.ids.filter(function(el) {
                                                if (el.id == parent.id) {
                                                    return true;
                                                }
                                            });
                                            if (dups.length == 0) {
                                                item.ids.push({id : parent.id});
                                            }
                                            add = false;
                                        }
                                    });
                                    if (add) {
                                        entity.parents.push(parent);
                                    }
                                });
                            });
                        });
                    });



                    function getNiveauIndex(niveauId) {
                        var niveauOb = niveauIndex.filter(function(niveauOb) {
                            return niveauOb.niveau_id == niveauId;
                        }).pop();
                        if (!niveauOb) {
                            niveauOb = {
                                niveau_id: niveauId,
                            };
                            niveauIndex.push(niveauOb);
                        }
                        return niveauOb;
                    }

                    function onlyUnique(value, index, self) {
                        return self.indexOf(value)===index;
                    }

                    function addParentsToNiveauIndex(parents, niveaus) {
                        if (!niveaus || !niveaus.forEach) {
                            return;
                        }
                        niveaus.forEach(function(niveauId) {
                            var niveau = getNiveauIndex(niveauId);
                            parents.forEach(function(parentEntry) {
                                var parentId = parentEntry.id;
                                var parent = curriculum.index.id[parentId];
                                if (!parent) {
                                    console.log('missing parent '+parentId);
                                    return;
                                }
                                if (!niveau[parent.section+'_id']) {
                                    niveau[parent.section+'_id'] = [];
                                }
                                if (niveau[parent.section+'_id'].indexOf(parentId)==-1) {
                                    niveau[parent.section+'_id'].push(parentId);
                                }
                                if (typeof parent.parents != 'undefined') {
                                    addParentsToNiveauIndex(parent.parents, niveaus);
                                }
                            });
                        });
                        parents.forEach(function(parentEntry) {
                            var parentId = parentEntry.id;
                            if (!reverseNiveauIndex[parentId]) {
                                reverseNiveauIndex[parentId] = [];
                            }
                            reverseNiveauIndex[parentId] = reverseNiveauIndex[parentId].concat(niveaus).filter(onlyUnique);
                        });
                    }

                    curriculum.data.doelniveau
                    .concat(curriculum.data.examenprogramma_eindterm)
                    .forEach(function(entity) {
                        if (entity.niveau_id && entity.parents) {
                            addParentsToNiveauIndex(entity.parents, entity.niveau_id);
                            entity.niveau_id.forEach(function(niveauId) {
                                var index = getNiveauIndex(niveauId);
                                if (typeof index.doel_id == 'undefined') {
                                    index.doel_id = [];
                                }
                                if (entity.doel_id) {
                                    entity.doel_id.forEach(function(doelId) {
                                        if (index.doel_id.indexOf(doelId)==-1) {
                                            index.doel_id.push(doelId);
                                        }
                                    });
                                }
                                if (entity.kerndoel_id) {
                                    entity.kerndoel_id.forEach(function(doelId) {
                                        //FIXME: make index.kerndoel_id?
                                        if (index.doel_id.indexOf(doelId)==-1) {
                                            index.doel_id.push(doelId);
                                        }
                                    });
                                }
                            });
                        }
                    });

                    entityEditor.view.niveaus = [{ niveau: { value: '', innerHTML: 'Selecteer niveau'} }]
                        .concat(niveauIndex.map(function(n) {
                            return {
                                niveau: {
                                    value: n.niveau_id,
                                    innerHTML: curriculum.index.id[n.niveau_id].title
                                }
                            };
                        }));

                    
                    simply.activate.addListener('context-select', function() {
                        treeviewSchemas = new vanillaSelectBox('.slo-treeview-schemas', {'placeHolder':'Selecteer contexten'});
                    });
                    // restore changes from localstorage;
                    if (localStorage.changes) {
                        entityEditor.view.changes = JSON.parse(localStorage.changes);
                        entityEditor.view.changeCount = entityEditor.view.changes.length;
                        entityEditor.view.changes.forEach(function(entry) {
                            if (curriculum.index.id[entry.id]) {
                                originalEntities[entry.id] = clone(curriculum.index.id[entry.id]);
                            }
                            curriculum.index.id[entry.id] = clone(entry);
                            curriculum.index.type[entry.id] = entry.section;
                        });
                    }
					curriculum.loaded = true;
					document.addEventListener('simply-content-loaded', function() {
	                    document.body.dataset.loading = "false";
    	                simply.route.handleEvents();
        	            simply.route.match();
					});
					let script = document.createElement('script');
					script.dataset.simplyStorage = 'none';
					script.src = "https://canary.simplyedit.io/1/simply-edit.js";
					document.body.appendChild(script);
                    return true;
                });
            }
        }
    });

	document.addEventListener('simply-content-loaded', initEditor);

	function initEditor() {
		if (!curriculum || !curriculum.loaded) {
			window.setTimeout(initEditor, 500);
			return;
		}
        var counter = 1000;
        Object.keys(curriculum.data).forEach(function(dataset) {
            if (dataset!='deprecated') {
                editor.addDataSource(dataset, {
                    load : function(el, callback) {
                        document.body.dataset.loading = "true";
                        var options = '';
                        curriculum.data[dataset].forEach(function(entity) {
                            var option = entity.title;

                            if (curriculum.index.type[entity.id] == "doelniveau") {
                                var doel;
                                var niveau;
                                if (entity.doel_id) {
                                    doel = curriculum.index.id[entity.doel_id[0]];
                                }
                                if (entity.kerndoel_id) {
                                    doel = curriculum.index.id[entity.kerndoel_id[0]];
                                }
                                if (entity.eindterm_id) {
                                    doel = curriculum.index.id[entity.eindterm_id[0]];
                                }
                                if (entity.niveau_id) {
                                    niveau = curriculum.index.id[entity.niveau_id[0]];
                                }
                                if (doel && niveau) {
                                    option = "[" + niveau.title + "] " + doel.title;
                                }
                            }
                            if (navigator.userAgent.indexOf('Chrome/') === -1) {
                                option += ' ' + entity.id;
                            }
                            options += "<option value='" + entity.id + "'>" + option + "</option>";
                        });
                        window.setTimeout(function() {
                            el.innerHTML = options;
                            el.dataset.simplyDataName = dataset;
                            document.body.dataset.loading = "false";
                        }, counter);
                        counter+=1000;
                    }
                });
            }
        });
        editor.addDataSource("entities", {
            load : function(el, callback) {
                document.body.dataset.loading = "true";
                var options = '';

                // Priorities for sorting - we want the higher level entities to come first in the list.
                var priorities = {
                    "vakleergebied" : 5,
                    "lpib_vakleergebied" : 4,
                    "leerlijn" : 3,
                    "examenprogramma" : 2,
                    "examenprogramma_bg": 1,
                    "ldk_vakleergebied": 0,
                    "inh_vakleergebied": 0,
                    "ref_vakleergebied": 0
                };

                var isChrome = navigator.userAgent.indexOf('Chrome/')!==-1;
                
                Object.values(curriculum.index.id)
                .sort(function(a, b) {
                    if (priorities[a.section]) {
                        if (priorities[b.section]) {
                            if (priorities[a.section] > priorities[b.section]) {
                                return -1;
                            }
                            if (priorities[a.section] < priorities[b.section]) {
                                return 1;
                            }
                            if (a.title > b.title) {
                                return 1;
                            }
                            if (a.title < b.title) {
                                return -1;
                            }
                        } else {
                            return -1;
                        }
                    }
                    if (priorities[b.section]) {
                        return 1;
                    }
                    return 0;
                }).forEach(function(entity) {
                    var option = curriculum.index.type[entity.id]+': '+entity.title;

                    if (curriculum.index.type[entity.id] == "doelniveau") {
                        var doel;
                        var niveau;
                        if (entity.doel_id) {
                            doel = curriculum.index.id[entity.doel_id[0]];
                        }
                        if (entity.kerndoel_id) {
                            doel = curriculum.index.id[entity.kerndoel_id[0]];
                        }
                        if (entity.eindterm_id) {
                            doel = curriculum.index.id[entity.eindterm_id[0]];
                        }
                        if (entity.niveau_id) {
                            niveau = curriculum.index.id[entity.niveau_id[0]];
                        }
                        if (doel && niveau) {
                            option = "[" + niveau.title + "] " + doel.title;
                        }
                    }
                    if (!isChrome) {
                        option += ' ' + entity.id;
                    }
                    if (!entity.deleted && curriculum.index.type[entity.id] != 'deprecated') {
                        options += "<option value='" + entity.id + "'>" + option + "</option>";
                    }
                });
                window.setTimeout(function() {
                    el.innerHTML = options;
                    document.body.dataset.loading = "false";
                });
            }
        });
        editor.addDataSource('schemas', {
            load: Object.keys(curriculum.schemas).sort().map(function(s) {
                return {
                    schema: {
                        value: s,
                        innerHTML: s
                    }
                };
            })
        });
        editor.addDataSource('multipleparents', {
            load: function(el, callback) {
                var result = Object.values(curriculum.index.id)
                .filter(function(entry) {
                    if(
                        entry.parents &&
                        entry.parents.length &&
                        entry.parents[entry.parents.length-1].ids.length > 1
                    ) {
                        return true;
                    } else {
                        return false;
                    }
                })
				var newHtml = '';
				result.forEach(function(item) {
					newHtml += '<a href="#edit/' + item.id + '">' + item.id + '</a><br>';
				});
				el.innerHTML = newHtml;
            }
        });
        editor.transformers = {
            "round" : {
                "render" : function(data) {
                    return Math.round(100 * (1-data),2) + "%";
                }
            },
            "opendatalink" : {
                "render" : function(data) {
                    this._data = data;
                    data = "https://opendata.slo.nl/curriculum/api-acpt/v1/uuid/"+data;
                    return data;
                },
                "extract": function() {
                    return this._data;
                }
            },
            "editlink" : {
                "render" : function(data) {
                    return {
                        innerHTML : data,
                        href : document.location.pathname + "#edit/" + data
                    };
                },
                "extract" : function(el) {
                    return el.innerHTML;
                }
            },
            "uuid": {
                "render": function(data) {
                    this.id = data;
                    return data;
                }
            },
            "idToTitle": {
                "render" : function(data) {
                    this.sloId = data;
                    var entity = clone(curriculum.index.id[data]);
                    if (curriculum.index.type[data] == "doelniveau") {
                        if (entity.doel_id && entity.doel_id[0]) {
                            var doel = clone(curriculum.index.id[entity.doel_id[0]]);
                        } else if (entity.kerndoel_id && entity.kerndoel_id[0]) {
                            var doel = clone(curriculum.index.id[entity.kerndoel_id[0]]);
                        }
                        if (entity.niveau_id && entity.niveau_id[0]) {
                            var niveau = clone(curriculum.index.id[entity.niveau_id[0]]);
                        }
                        var result = '';
                        if (niveau && niveau.title ) {
                            result += '['+niveau.title+'] ';
                        } else {
                            result += '[geen niveau]';
                        }
                        if (doel && doel.title) {
                            result += doel.title;
                        } else {
                            result += 'geen doel';
                        }
                    } else {
                        if (typeof curriculum.index.id[data] == 'undefined') {
                            return 'missing';
                        }
                        result = curriculum.index.id[data].title ? clone(curriculum.index.id[data].title) : "";
                    }
                    return result + ' ('+curriculum.index.type[data]+')';
                },
                "extract" : function(el) {
                    return this.sloId;
                }
            },
            "hasDescription" : {
                render : function(data) {
                    return (typeof data.description !== "undefined");
                }
            },
            "hasTitle" : {
                render : function(data) {
                    return (typeof data.title !== "undefined");
                }
            },
            "isarray" : {
                render : function(data) {
                    this.data = data;
                    return Array.isArray(data);
                },
                extract : function(el) {
                    return this.data;
                }
            },
            "searchoption" : {
                render : function(entity) {
                    entity = clone(entity);
                    this.data = entity;
                    var option = entity.title + " " + entity.id;

                    if (curriculum.index.type[entity.id]=="doelniveau") {
                        var doel = clone(curriculum.index.id[entity.doel_id[0]]);
                        var niveau = clone(curriculum.index.id[entity.niveau_id[0]]);
                        option = "[" + niveau.title + "] " + doel.title + " " + entity.id;
                    }

                    return {
                        innerHTML : option,
                        value : entity.id
                    };
                },
                extract : function(el) {
                    return this.data;
                }
            }
        };
	}

	function escapeQuotes(s) {
		return s.replace('"','\x22').replace("'",'\x27');
	}
	
	function getDoelNiveauTitle(entity) {
		if (!entity.niveau_id || !Array.isArray(entity.niveau_id) || !entity.niveau_id.length) {
			var niveau = 'geen';
		} else {
			var niveau = entity.niveau_id.map(function(id) {
				return  curriculum.index.id[id].title;
			}).join(',');
		}
		var title = [];
		['doel_id','kerndoel_id','examenprogramma_eindterm_id','examenprogramma_subdomein_id','examenprogramma_domeid_id'].forEach(function(prop) {
			if (entity[prop] && Array.isArray(entity[prop]) && entity[prop].length) {
				entity[prop].forEach(function(childId) {
					title.push(prop.substr(0,prop.length-3)+': '+curriculum.index.id[childId].title);
				});
			}
		});
		return '('+niveau+') '+'['+(title.length)+'] '+title.join(',');
	}
	
    (function() {
        var login;
        var loginString = localStorage.getItem('login');
        if (loginString) {
            try {
                login = JSON.parse(loginString);
            } catch(e) {
            }
        }
        if (login) {
            entityEditor.actions.autologin(login.username, login.password);
        } else {
            entityEditor.actions.showLogin();
        }
    })();
    
    function clone(ob) {
        if (typeof ob == 'undefined' || ob == null) {
            return null;
        }
        return JSON.parse(JSON.stringify(ob));
    }


    // Yucky code, but chrome handles large datalists very poorly. This is to make it only do autocompletion
    // when enough characters have been entered. Firefox doesn't even break a sweat with this;
    if (window.chrome) {
        document.addEventListener("input", function(evt) {
            if (evt.target.hasAttribute("list") && !evt.target.hasAttribute("data-list")) {
                evt.target.setAttribute("data-list", evt.target.getAttribute("list"));
            }
            if (evt.target.getAttribute("data-list")) {
                if (evt.target.value.length > 3) {
                    evt.target.setAttribute("list", evt.target.getAttribute("data-list"));
                } else {
                    evt.target.removeAttribute("list");
                }
            }
        }, true);
    }


    simply.activate.addListener('autosize', function() {
        var self = this;
        self.style.height = 'auto';
        self.style.height = (self.scrollHeight+2)+'px';
           this.addEventListener('input',function(evt) {
            window.setTimeout(function() {
                self.style.height = 'auto';
                self.style.height = (self.scrollHeight+2)+'px';
            },0);
        });
    });

    var lpibMatches = {};
    var reverseLpibMatches = {};
    function checkLPIBMatch() {
        fetch('lpib-matches.json').then(function(data) {
            return data.json();
        })
        .then(function(json) {
            lpibMatches = json;
            // fix bk:ids, load reverse of matches
            Object.keys(lpibMatches).forEach(function(lpibId) {
                lpibMatches[lpibId].forEach(function(obkId, index) {
                    if (obkId.substr(0,3)==='bk:') {
                        obkId = obkId.substr(3);
                        lpibMatches[lpibId][index] = obkId;
                    }
                    if (!reverseLpibMatches[obkId]) {
                        reverseLpibMatches[obkId] = [];
                    }
                    reverseLpibMatches[obkId].push(lpibId);
                });
            });
            // find matches that have n to m relations
            // lpibMatches[x] has more than 1 entry
            // and reverseLpibMatches[y] for at least on of those entries has more than 1 entry
            var lpibN = Object.keys(lpibMatches).filter(function(lpibId) {
                return lpibMatches[lpibId].length>1;
            });
            lpibNM = lpibN.filter(function(lpibId) {
                var M = false;
                lpibMatches[lpibId].forEach(function(obkId) {
                    if (reverseLpibMatches[obkId].length>1) {
                        M = true;
                    }
                });
                return M;
            });
            lpibNM.forEach(function(lpibId) {
                var lpEnt = curriculum.index.id[lpibId];
                console.group('N to M link:')
                console.log('From '+lpEnt.id+' '+lpEnt.title);
                lpibMatches[lpibId].forEach(function(obkId) {
                    if (reverseLpibMatches[obkId].length>1) {
                        var obkEnt = curriculum.index.id[obkId];
                        console.log('To '+obkEnt.id+' '+obkEnt.title);
                        console.group('Which also links to:')
                        reverseLpibMatches[obkId].forEach(function(lpibId) {
                            var lpEnt2 = curriculum.index.id[lpibId];
                            console.log(lpEnt2.id+' '+lpEnt2.title);
                        });
                        console.groupEnd();
                    }
                });
                console.groupEnd();
            });
        })
        .catch(function(err) {
            console.error(err);
        });
    }

    /* Code to remember scroll position when the lists are changed and redrawn */
    function rememberScrollPosition() {
        window.scrollPosition = {
            y: window.scrollY,
            x: window.scrollX
        };
    }
    window.addEventListener("databind:elementresolved", function(evt) {
        window.setTimeout(function() {
            delete window.scrollPosition;
        }, 200);
    });

    window.addEventListener("scroll", function(evt) {
        if (typeof window.scrollPosition !== "undefined") {
            window.scrollTo(window.scrollPosition.x, window.scrollPosition.y);
        }
    });

    simply.activate.addListener('updateDatalist', function() {
        let el = this;
        el.addEventListener('change', function(evt) {
            document.getElementById('searchEntity').setAttribute('list',el.value);
        });
    });

    function getContextFromId(id) {
        var section = curriculum.index.type[id];
        var context = Object.keys(curriculum.schemas).filter(function(schema) {
            return typeof curriculum.schemas[schema].properties[section]!='undefined';
        }).pop();
        return context;
    };

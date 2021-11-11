let getExportTree = (function() {

    function getSchema(e) {
        var section = curriculum.index.type[e.id];
        var schema = Object.keys(curriculum.schemas).filter(function(schema) {
            return typeof curriculum.schemas[schema].properties[section]!='undefined';
        }).pop();
        if (!schema) {
            console.error('no schema',e);
            throw new Error('No schema found for '+e.id);
        }
        return schema;
    };

    function niveausMatch(a,b) {
        return Array.isArray(a) && Array.isArray(b) && a.filter(n => b.includes(n)).length
    }

    function getLevels(niveaus) {
        return (niveaus && niveaus.length ? niveaus.map(id => curriculum.index.id[id].title).join(',') : '');
    };

    function getProperties(entity) {
        let schema = getSchema(entity);
        let section = curriculum.index.type[entity.id];
        return window.schemasParsed[schema].properties[section].items.properties;
    }

    function createRow(entity, parent=null) {
        let row = {
            ParentID: (parent ? parent.id : '')
        };

        let properties = getProperties(entity);
        if (entity.isDoelniveauSubstitute) {
            Object.assign(properties, {'prefix':true,'ce_se':true,'kern_keuze':true});
        }
        if (entity.id=='fd47894c-a2c4-428e-b723-8041bea55501') {
            debugger;
        }
        Object.keys(properties).forEach(p => {
            if (p.substr(-3)==='_id') {
                if (entity[p] && !Array.isArray(entity[p])) {
                    entity['references'] = entity[p];
                    properties['references'] = p;
                }
                // are included as seperate rows
                delete properties[p];
            }
			if (['replacedBy','replaces','unreleased','dirty'].includes(p)) {
				delete properties[p];
			}
        });

        let alias = {
            id: "ID",
            prefix: "Prefix",
            title: "Title",
            description: "Description",
            section: "Type",
            references: "verwijst naar"
        };
		properties.section = true;

        Object.keys(properties).forEach(p => {
            var rowProp = p.trim();
            if (alias[p]) {
                rowProp = alias[p];
            }
            if (typeof entity[p]!=='undefined') {
                row[rowProp] = entity[p];
            } else {
                row[rowProp] = '';
            }
        });
        if (entity.niveau_id) {
            row.Level = getLevels(entity.niveau_id);
        }
        return row;
    }

    function getDoelniveauSubstitute(entity) {
        if (curriculum.index.type[entity.id]!=='doelniveau') {
            console.error('Not a doelniveau:', entity);
            throw new Error('Cannot substitute entities other than doelniveau',entity);
        }
        if (!Array.isArray(entity.children) || !entity.children.length) {
            console.error('Empty doelniveau', entity);
            throw new Error('Cannot substitute empty doelniveau', entity);
        }
        let children = entity.children.slice();
        // get first child entry entity and remove it from children
        // prefer children of type 'doel'
        children.sort((a,b) => {
            if (curriculum.index.type[a]=='doel') {
                return -1;
            }
            if (curriculum.index.type[b]=='doel') {
                return 1;
            }
            return 0;
        });
        // get first child entry
        var sub = curriculum.index.id[children.shift()];
        if (!sub) {
            console.error('Unknown doelniveau child id', entity.children[0]);
            throw new Error('Cannot create substitute of unknown id', entity.children[0]);
        }
        sub = Object.assign({},sub);
        if (!sub.childNodes) {
            sub.childNodes = [];
        }
        // add all other children to it as childNodes
        children.forEach(child => {
            sub.childNodes.push(curriculum.index.id[child]);
        });
        // add entity levels to first child
        sub.niveau_id = entity.niveau_id;
        // add prefix/ce_se/kern_keuze from doelniveau, if available
        ['prefix','ce_se','kern_keuze'].forEach(key => {
            if (typeof entity[key] != 'undefined') {
                sub[key] = entity[key];
            }
        });
        // add marker that this substitutes a doelniveau, for createRow later
        sub.isDoelniveauSubstitute = true;
        return sub;
    }

    function writeExcel(json) {
        var ws = XLSX.utils.json_to_sheet(json, {
            header: ["ID", "ParentID", "Prefix", "Title", "Description", "Type", "Level"]
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
        ws.D1.s = {alignment:{ wrapText: true }}; // FIXME: this does nothing, upgrade to pro or user xlsx-style fork
        ws.E1.s = {alignment:{ wrapText: true }};
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sheet 1");
        XLSX.writeFile(wb, 'export.xlsx');
    }

    function substituteDoelniveaus(e) {
        if (curriculum.index.type[e.id] == 'doelniveau') {
            var foo = getDoelniveauSubstitute(e);
            return foo;
        }
        return e;
    }

    function filterNiveaus(e, niveaus) {
        if (!niveaus || !niveaus.length) {
            return true;
        }
        if (Array.isArray(e.niveau_id) && niveausMatch(e.niveau_id,niveaus)) {
            return true;
        }
        if (reverseNiveauIndex[e.id] && niveausMatch(reverseNiveauIndex[e.id], niveaus)) {
            return true;
        }
        if (!reverseNiveauIndex[e.id] && !Array.isArray(e.niveau_id)) {
            return true;
        }
        return false;
    }

    function treeFillChildnodes(entity, niveaus, schemas) {
        let filterByNiveaus = function(e) {
            return filterNiveaus(e, niveaus);
        }
        options = {
            topdownCallback: (e) => {
                if (e.prefix=='ak/1/1/1') {
                    debugger;
                }
                if (e.children) {
                    e.childNodes = e.children
                        .map( id => curriculum.index.id[id] || null )
                        .filter(Boolean)
                        .filter(filterByNiveaus)
                        .map(substituteDoelniveaus)
                }
            },
            terminalTypes: ['doelniveau'],
            limitSchemas: schemas
        };
        curriculum.treewalk(entity, options);
    }

    function walkChildnodes(entity, callback, parent=null) {
        callback(entity, parent);
        if (entity.childNodes) {
            entity.childNodes.forEach(child => walkChildnodes(child, callback, entity));
        }
    }

    function exportTree(entity, niveaus, schemas) {
        // 1 create a full tree
        treeFillChildnodes(entity, niveaus, schemas);
        console.log(entity);

        // 1b add niveaus to root entity levels
        if (!niveaus || !niveaus.length) {
            // get all niveaus in this export and add them to root entity
            var niveau_ids = {};
            walkChildnodes(entity, (e,p) => {
                if (e.niveau_id) {
                    e.niveau_id.forEach(n => {
                        niveau_ids[n] = true;
                    });
                }
            });
            entity.niveau_id = Object.keys(niveau_ids);
        } else {
            entity.niveau_id = niveaus;
        }

        // 4 create a json array with rows
        let exportJSON = [];
        walkChildnodes(entity, (e,p) => { 
            exportJSON.push(createRow(e,p)); 
            return e;
        });
        
        // 5 convert to excel sheet
        writeExcel(exportJSON);
    }

    return exportTree;
})();
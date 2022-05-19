import ELK from 'elkjs/lib/elk.bundled.js';
import assign from './assign';
import defaults from './defaults';

const elkOverrides = {};

const getPos = function (ele, options) {
    const dims = ele.layoutDimensions(options);
    const k = ele.scratch('elk');

    const p = {
        x: k.x,
        y: k.y,
    };

    var parent = ele.parent();
    if (parent.nonempty() & !parent.hasClass('cy-expand-collapse-collapsed-node')) {
        forceToPortsPos(k, p, dims, parent.id(), options.elkEleLookup)
    }
    ;

    while (parent.nonempty()) {
        var kp = options.elkEleLookup[parent.id()];
        p.x += kp.x;
        p.y += kp.y;
        parent = parent.parent();
    }

    // elk considers a node position to be its top-left corner, while cy is the centre
    p.x += dims.w / 2;
    p.y += dims.h / 2;

    return p;
};

const getFakeOutputPortX = function (ele) {
    var fakeOutport = ele.ports.filter(function (p) {
        return p.layoutOptions["port.side"] === "EAST"
    });
    var x = fakeOutport[0].x;
    // console.log(fakeOutport);
    // console.log(x);
    return x
};


const forceToPortsPos = function (k, p, dims, pid, elkEleLookup) {
    var category = k.category || '';
    var parent = elkEleLookup[pid];
    // var parentDims = parent.layoutDimensions(options);
    // if (parent.nonempty() & !parent.hasClass('cy-expand-collapse-collapsed-node')) {
    // var isGroup = parent.isGroup || 'false';
    //   // if () double ports
    if (category === 'output_port') {
        var out_x = getFakeOutputPortX(parent);
        p.x = out_x;
        p.y = 2 * dims.h * k.idx
    } else if (category === 'input_port') {
        p.x = 0;
        p.y = 2 * dims.h * k.idx;
    }
};

const makeNode = function (node, options) {
    const k = {
        _cyEle: node,
        id: node.id(),
        layoutOptions: node.data('layoutOptions') || {},
        category: node.data('category') || '',
        idx: node.data('idx') || 0,
        isGroup: node.data('isGroup') || 'false',
        labels: [{'text': node.data('label')}],
        ports: node.data('ports') || []
    };
    if (!node.hasClass('cy-expand-collapse-collapsed-node') & node.isParent()) {
        addPorts(node, k, options)
    }
    ;

    if (!node.isParent()) {
        const dims = node.layoutDimensions(options);
        const p = node.position();

        // the elk position is the top-left corner, cy is the centre
        k.x = p.x - dims.w / 2;
        k.y = p.y - dims.h / 2;

        k.width = dims.w;
        k.height = dims.h;
    }

    node.scratch('elk', k);

    return k;
};

const addPorts = function (node, k, options) {
    var w = 0;
    var h = node.children()[0].layoutDimensions(options).h;
    node.children().forEach(function (c) {
        var dim = c.layoutDimensions(options);
        if (dim.w > w) {
            w = dim.w;
        }
    });
    k.layoutOptions = {
        'elk.portConstraints': 'FIXED_SIDE',
        'nodeSize.constraints': "[NODE_LABELS, PORTS, PORT_LABELS]",
        "portLabels.placement": "INSIDE",
        "elk.portAlignment.default": "CENTER"
    };
    k.ports.push({
        'id': 'p0', "layoutOptions": {"port.side": "NORTH", "portLabels.placement": "OUTSIDE"},
        'labels': {"width": (node.data('label').length + 2) * 8.5, "height": h}
    });

    k.labels[0]["layoutOptions"]={"nodeLabels.placement": "[H_CENTER, V_TOP, OUTSIDE]"};
    k.labels[0]["width"]=(node.data('label').length + 2) * 8.5;
    k.labels[0]["height"]=h;


    if (node.data('label') === 'Input Ports' || node.data('label') === 'Output Ports') {
        var n = node.children().length;
        var side = node.data('label') === 'Input Ports' ? "WEST" : "EAST";
        var H_ = node.data('label') == 'Input Ports' ? "[H_LEFT, V_CENTER, OUTSIDE]" : "[H_RIGHT, V_CENTER, OUTSIDE]";
        k.ports.push({
            'id': 'p1',
            "layoutOptions": {"port.side": side},
            'labels': [{"width": w, "height": h * n * 2}]
        });

        // k.labels.push({"text": side})
        // k.labels[1]["layoutOptions"]={"nodeLabels.placement": H_};
        // k.labels[1]["width"]=w;
        // k.labels[1]["height"]=h*n*2;
    }
    ;
    if (node.data('isGroup') != 'true') {
        var num_inputs = node.children().filter(function (n) {
            return n.data('category') === 'input_port'
        }).length;
        var num_outputs = node.children().filter(function (n) {
            return n.data('category') === 'output_port'
        }).length;
        k.ports.push({
            'id': 'p3', "layoutOptions": {"port.side": "WEST"},
            'labels': {"text": "", "width": w, "height": (h * 2 * num_inputs)}
        }, {
            'id': 'p4', "layoutOptions": {"port.side": "EAST"},
            'labels': {"text": "", "width": w, "height": (h * 2 * num_outputs)}
        });


        k.labels.push({"text": "OUT"})
        k.labels[1]["layoutOptions"]={"nodeLabels.placement": "[H_RIGHT, V_CENTER, OUTSIDE]"};
        k.labels[1]["width"]=w;
        k.labels[1]["height"]=h * 2 * num_outputs;

        // k.labels.push({"text": "IN"})
        // k.labels[2]["layoutOptions"]={"nodeLabels.placement": "[H_LEFT, V_CENTER, OUTSIDE]"};
        // k.labels[2]["width"]=w;
        // k.labels[2]["height"]=h * 2 * num_inputs;
    }
    ;
    k.width = w;
    k.height = h * 2 * n
};

const makeEdge = function (edge /*, options*/) {
    const k = {
        _cyEle: edge,
        id: edge.id(),
        source: edge.data('source'),
        target: edge.data('target'),
    };

    edge.scratch('elk', k);

    return k;
};

const makeGraph = function (nodes, edges, options) {
    const elkNodes = [];
    const elkEdges = [];
    const elkEleLookup = {};
    const graph = {
        id: 'root',
        children: [],
        edges: [],
    };

    // map all nodes
    for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const k = makeNode(n, options);

        elkNodes.push(k);

        elkEleLookup[n.id()] = k;
    }

    // map all edges
    for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        const k = makeEdge(e, options);

        elkEdges.push(k);

        elkEleLookup[e.id()] = k;
    }

    // make hierarchy
    for (let i = 0; i < elkNodes.length; i++) {
        const k = elkNodes[i];
        const n = k._cyEle;

        if (!n.isChild()) {
            graph.children.push(k);
        } else {
            const parent = n.parent();
            const parentK = elkEleLookup[parent.id()];

            const children = (parentK.children = parentK.children || []);

            children.push(k);
        }
    }

    for (let i = 0; i < elkEdges.length; i++) {
        const k = elkEdges[i];

        // put all edges in the top level for now
        // TODO does this cause issues in certain edgecases?
        /*let e = k._cyEle;
        let parentSrc = e.source().parent();
        let parentTgt = e.target().parent();
        if ( false && parentSrc.nonempty() && parentTgt.nonempty() && parentSrc.same( parentTgt ) ){
          let kp = elkEleLookup[ parentSrc.id() ];

          kp.edges = kp.edges || [];

          kp.edges.push( k );
        } else {*/
        graph.edges.push(k);
        //}
    }

    return {graph, elkEleLookup};
};

class Layout {
    constructor(options) {
        const elkOptions = options.elk;
        const {cy} = options;

        this.options = assign({}, defaults, options);

        this.options.elk = assign(
            {
                aspectRatio: cy.width() / cy.height(),
            },
            defaults.elk,
            elkOptions,
            elkOverrides
        );
    }

    run() {
        const layout = this;
        const {options} = this;

        const {eles} = options;
        const nodes = eles.nodes();
        const edges = eles.edges();

        const elk = new ELK();
        const {graph, elkEleLookup} = makeGraph(nodes, edges, options);
        options.elkEleLookup = elkEleLookup;
        graph['layoutOptions'] = options.elk
        elk
            .layout(graph)
            .then(() => {
                nodes
                    .filter((n) => !n.isParent())
                    .layoutPositions(layout, options, (n) => getPos(n, options));
            });

        return this;
    }

    stop() {
        return this; // chaining
    }

    destroy() {
        return this; // chaining
    }
}

export default Layout;

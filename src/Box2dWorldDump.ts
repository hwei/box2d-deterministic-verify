class StringBuilder {
    private readonly _strings = new Array<string>();
    private _indent = '';
    
    append(...s: Array<string>) {
        this._strings.push(this._indent);
        this._strings.push(...s);
    }

    addIndent() {
        this._indent += '  ';
    }

    removeIndent() {
        this._indent = this._indent.substr(0, this._indent.length - 2);
    }

    toString() {
        return this._strings.join('');
    }

    clear() {
        this._strings.length = 0;
    }
}

const tmpStringBuilder = new StringBuilder();
const tmpObjNameMap = new Map<any, string>();

export default function dump(world: any) {
    // name objects
    tmpObjNameMap.set(null, 'null');
    nameBodyAndFixture(world.m_bodyList, tmpObjNameMap);
    const contactManager = world.m_contactManager;
    const broadPhase = contactManager.m_broadPhase;
    nameTreeNode(broadPhase.m_tree.m_root, tmpObjNameMap);
    nameContactAndEdge(contactManager.m_contactList, tmpObjNameMap);
    
    // dump contactManager
    dumpContactManager(contactManager, tmpObjNameMap, tmpStringBuilder);

    // dump all body
    dumpBodyList(world.m_bodyList, tmpStringBuilder, tmpObjNameMap);

    const r = tmpStringBuilder.toString();

    tmpStringBuilder.clear();
    tmpObjNameMap.clear();

    return r;
}

function nameTreeNode(node: any, objNameMap: Map<any, string>) {
    if(!node)
        return;
    objNameMap.set(node, `b2TreeNode(${node.m_id})`);
    nameTreeNode(node.child1, objNameMap);
    nameTreeNode(node.child2, objNameMap);
}

function nameBodyAndFixture(body: any, objNameMap: Map<any, string>) {
    for(let i = 0; body; body = body.m_next, ++i) {
        objNameMap.set(body, `b2Body(${i})`);
        let fixture = body.m_fixtureList;
        for(let j = 0; fixture; fixture = fixture.m_next, ++j) {
            objNameMap.set(fixture, j === 0 ? `b2Fixture(${i})` : `b2Fixture(${i}, ${j})`);
        }
    }
}

function nameContactAndEdge(contact: any, objNameMap: Map<any, string>) {
    for(let i = 0; contact; contact = contact.m_next, ++i) {
        objNameMap.set(contact, `b2Contact(${i})`);
        objNameMap.set(contact.m_nodeA, `b2ContactEdge(${i},A)`);
        objNameMap.set(contact.m_nodeB, `b2ContactEdge(${i},B)`);
    }
}

function dumpTreeNode(node: any, stringBuilder: StringBuilder) {
    if (!node)
        return;
    stringBuilder.addIndent();
    stringBuilder.append(`.m_id: ${node.m_id}\n`);
    stringBuilder.append(`.aabb: ${aabbToString(node.aabb)}\n`);
    stringBuilder.append('child1:\n');
    dumpTreeNode(node.child1, stringBuilder);
    stringBuilder.append('child2:\n');
    dumpTreeNode(node.child2, stringBuilder);
    stringBuilder.removeIndent();
}

function aabbToString(aabb: any) {
    const { lowerBound, upperBound } = aabb;
    return `${lowerBound.x},${lowerBound.y},${upperBound.x},${upperBound.y}`;
}

function dumpContactManager(contactManager: any, objNameMap: Map<any, string>, stringBuilder: StringBuilder) {
    stringBuilder.append('.m_contactManager:\n');
    stringBuilder.addIndent();
    dumpBroadPhase(contactManager.m_broadPhase, stringBuilder);
    dumpContactList(contactManager.m_contactList, objNameMap, stringBuilder);
    stringBuilder.removeIndent();
}

function dumpBroadPhase(broadPhase: any, stringBuilder: StringBuilder) {
    // dump broadPhase
    stringBuilder.append('.m_broadPhase:\n');
    stringBuilder.addIndent();

    stringBuilder.append('.m_moveBuffer: ');
    for(let i = 0; i < broadPhase.m_moveCount; ++i) {
        stringBuilder.append(tmpObjNameMap.get(broadPhase.m_moveBuffer[i]) + ',');
    }
    stringBuilder.append('\n');

    // dump all tree node
    stringBuilder.append('.m_tree:\n');
    dumpTreeNode(broadPhase.m_tree.m_root, stringBuilder);

    // end dump broadPhase
    stringBuilder.removeIndent();
}

function dumpContactList(contact: any, objNameMap: Map<any, string>, stringBuilder: StringBuilder) {
    for(let i = 0; contact; contact = contact.m_next, ++i) {
        stringBuilder.append(`.m_contactList ${objNameMap.get(contact)}:\n`);
        stringBuilder.addIndent();
        stringBuilder.append('m_fixtrueA: ' + objNameMap.get(contact.m_fixtrueA), '\n');
        stringBuilder.append('m_fixtrueB: ' + objNameMap.get(contact.m_fixtrueB), '\n');
        stringBuilder.append('m_flags: ', contactFlagsToString(contact.m_flag_bulletHitFlag), '\n');
        stringBuilder.append('m_friction: ' + contact.m_friction, '\n');
        stringBuilder.append('m_indexA: ' + contact.m_indexA, '\n');
        stringBuilder.append('m_indexB: ' + contact.m_indexB, '\n');
        stringBuilder.append('m_nodeA: ' + objNameMap.get(contact.m_nodeA), '\n');
        stringBuilder.append('m_nodeB: ' + objNameMap.get(contact.m_nodeB), '\n');
        stringBuilder.append('m_restitution: ' + contact.m_restitution, '\n');
        stringBuilder.append('m_toi: ' + contact.m_toi, '\n');
        stringBuilder.append('m_toiCount: ' + contact.m_toiCount, '\n');

        // end dump broadPhase
        stringBuilder.removeIndent();
    }
}

function b2n(b: boolean) {
    return b ? 1 : 0;
}

function contactFlagsToString(contact: any) {
    return '' + b2n(contact.m_flag_bulletHitFlag) +
    b2n(contact.m_flag_enabledFlag) +
    b2n(contact.m_flag_filterFlag) +
    b2n(contact.m_flag_islandFlag) +
    b2n(contact.m_flag_toiFlag) +
    b2n(contact.m_flag_touchingFlag);
}

function dumpBodyList(body: any, stringBuilder: StringBuilder, objNameMap: Map<any, string>) {
    for(let i = 0; body; body = body.m_next, ++i) {
        stringBuilder.append(`.m_bodytList: ${objNameMap.get(body)}\n`);
        stringBuilder.addIndent();
        stringBuilder.append('m_I: ' + body.m_I, '\n');
        stringBuilder.append('m_flags: ', bodyFlagsToString(body), '\n');
        stringBuilder.append('m_islandIndex: ' + body.m_islandIndex, '\n');
        stringBuilder.append('m_linearVelocity: ' + vec2ToString(body.m_linearVelocity), '\n');
        stringBuilder.append('m_sleepTime: ' + body.m_sleepTime, '\n');
        stringBuilder.append('m_type: ' + body.m_type, '\n');
        stringBuilder.append('m_xf: ', transformToString(body.m_xf), '\n');
        stringBuilder.append('m_xf0: ', transformToString(body.m_xf0), '\n');
        let contact = body.m_contactList;
        stringBuilder.append('m_contactList:\n');
        stringBuilder.addIndent();
        for(let j = 0; contact; contact = contact.next, ++j) {
            stringBuilder.append('' + objNameMap.get(contact), '\n');
        }
        stringBuilder.removeIndent();

        // end dump broadPhase
        stringBuilder.removeIndent();
    }
}

function bodyFlagsToString(body: any) {
    return '' + b2n(body.m_flag_activeFlag) +
    b2n(body.m_flag_autoSleepFlag) +
    b2n(body.m_flag_awakeFlag) +
    b2n(body.m_flag_islandFlag);
}

function vec2ToString(vec2: any) {
    return `${vec2.x},${vec2.y}`;
}

function transformToString(xf: any) {
    const { p, q } = xf;
    return `${p.x},${p.y};${q.angle},${q.s},${q.c}`;
}

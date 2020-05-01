import box2d from './box2dHelper';
import Box2dWorldDump from './Box2dWorldDump';

const VELOCITY_ITERATIONS = 8;
const POSITION_ITERATIONS = 3;

const tmpNodeMap = new Map<any, any>();

export default class Box2dWorldRollbacker {
    private readonly _world: Box2D.Dynamics.b2World;
    private _currentStep = 0;
    private readonly _bodyBackupArray = new Array<Array<BodyBackup>>();
    private readonly _contactManagerBackupArray = new Array<ContactMangerBackup>();
    private _backupCount = 0;
    clearBackupOnRollback = true;

    constructor(world: Box2D.Dynamics.b2World) {
        this._world = world;
        (window as any).myWorld = world;
        (window as any).myRollbacker = this;
    }

    get currentStep() {
        return this._currentStep;
    }

    get backupCount() {
        return this._backupCount;
    }

    step(dt: number) {
        // backup last step
        // console.log('backup step', this._currentStep, 'to', this._backupCount, ' current step is', this._currentStep + 1);
        //console.log(Box2dWorldDump(this._world));

        this._backup();

        // if(this._currentStep + 1 === 4) {
        //     debugger;
        // }

        // get new step
        this._world.Step(dt, VELOCITY_ITERATIONS, POSITION_ITERATIONS);

        this._currentStep++;
    }

    rollbackTo(step: number) {
        this.rollbackBy(this._currentStep - step);
    }

    rollbackBy(backN: number) {
        if(backN < 0)
            throw 'Negative rollback';
        if(backN === 0) {
            this._clearBackup();
            return;
        }
        if(backN > this._backupCount)
            throw 'Too much rollback';

        const backupIndex = this._backupCount - backN;
        // restore
        // console.log('restore backup at', backupIndex);
        this._restore(backupIndex);
        // set status
        this._currentStep -= backN;
    }

    private _backup() {
        const backupIndex = this._backupCount++;

        // backup contact manager
        let contactManagerBackup = this._contactManagerBackupArray[backupIndex];
        if(!contactManagerBackup) {
            contactManagerBackup = new ContactMangerBackup();
            this._contactManagerBackupArray[backupIndex] = contactManagerBackup;
        }
        contactManagerBackup.backup((this._world as any).m_contactManager, tmpNodeMap);

        // backup bodies
        let body = (this._world as any).m_bodyList;
        const b2_staticBody = box2d.b2BodyType.b2_staticBody;
        if (this._bodyBackupArray.length === backupIndex) {
            const bodyBackups = new Array<BodyBackup>();
            this._bodyBackupArray.push(bodyBackups);
            for(; body; body = body.m_next) {
                if(body.m_type === b2_staticBody)
                    continue;
                const bodyBackup = new BodyBackup();
                bodyBackup.backup(body, tmpNodeMap);
                bodyBackups.push(bodyBackup);
            }
        } else {
            const bodyBackups = this._bodyBackupArray[backupIndex];
            let i = 0;
            for(;body; body = body.m_next) {
                if(body.m_type === b2_staticBody)
                    continue;
                bodyBackups[i++].backup(body, tmpNodeMap);
            }
        }

        tmpNodeMap.clear();
    }

    private _restore(backupIndex: number) {
        // backup contact manager
        this._contactManagerBackupArray[backupIndex].restore((this._world as any).m_contactManager);

        // restore bodies
        const bodyBackups = this._bodyBackupArray[backupIndex];
        let body = (this._world as any).m_bodyList;
        const b2_staticBody = box2d.b2BodyType.b2_staticBody;
        let i = 0;
        for(; body; body = body.m_next) {
            if(body.m_type === b2_staticBody)
                continue;
            bodyBackups[i++].restore(body);
        }

        if (this.clearBackupOnRollback) {
            this._clearBackup();
        } else {
            // clear backup after backupIndex
            const contactManager = (this._world as any).m_contactManager;
            for(let i = backupIndex + 1; i < this._backupCount; ++i) {
                this._contactManagerBackupArray[i].clear(contactManager);
            }
            this._backupCount = backupIndex;
        }
        
    }

    private _clearBackup() {
        const contactManager = (this._world as any).m_contactManager;
        for(let i = 0; i < this._backupCount; ++i) {
            this._contactManagerBackupArray[i].clear(contactManager);
        }
        this._backupCount = 0;
    }
}


class BodyBackup {
    private readonly _sweep = new box2d.b2Sweep();
    private readonly _linearVelocity = new box2d.b2Vec2();
    private _angularVelocity = 0;
    private _flag_activeFlag = false;
    private _flag_autoSleepFlag = false;
    private _flag_awakeFlag = false;
    private _flag_islandFlag = false;
    private _islandIndex = 0;
    private _sleepTime = 0;
    private readonly _xf = new (box2d.b2Transform as any)();
    private readonly _xf0 = new (box2d.b2Transform as any)();
    private readonly _fixtureProxyCountArray = new Array<number>();
    private readonly _fixtureProxyArray = new Array<Array<any>>();

    backup(body: any, treeNodeMap: Map<any, any>) {
        (this._sweep as any).Copy(body.m_sweep);
        (this._linearVelocity as any).Copy(body.m_linearVelocity);
        this._angularVelocity = body.m_angularVelocity;
        this._flag_activeFlag = body.m_flag_activeFlag;
        this._flag_autoSleepFlag = body.m_flag_autoSleepFlag;
        this._flag_awakeFlag = body.m_flag_awakeFlag;
        this._flag_islandFlag = body.m_flag_islandFlag;
        this._islandIndex = body.m_islandIndex;
        this._sleepTime = body.m_sleepTime;
        this._xf.Copy(body.m_xf);
        this._xf0.Copy(body.m_xf0);

        // backup fixture proxy
        const fixtureProxyArray = this._fixtureProxyArray;
        let fixtureIndex = 0;
        for(let fixture = body.m_fixtureList; fixture; fixture = fixture.m_next) {
            let proxyArray: Array<Box2D.Collision.b2AABB> | undefined;
            if (fixtureProxyArray.length === fixtureIndex) {
                proxyArray = new Array<Box2D.Collision.b2AABB>();
                fixtureProxyArray.push(proxyArray);
            } else {
                proxyArray = fixtureProxyArray[fixtureIndex];
            }
            this._fixtureProxyCountArray[fixtureIndex] = fixture.m_proxyCount;
            fixtureIndex++;

            let proxyIndex = 0;
            for(const fixtureProxy of fixture.m_proxies) {
                proxyArray[proxyIndex++] = treeNodeMap.get(fixtureProxy.proxy);
            }

        }
    }

    restore(body: any) {
        body.m_sweep.Copy(this._sweep);
        body.m_linearVelocity.Copy(this._linearVelocity);
        body.m_angularVelocity = this._angularVelocity;
        body.m_flag_activeFlag = this._flag_activeFlag;
        body.m_flag_autoSleepFlag = this._flag_autoSleepFlag;
        body.m_flag_awakeFlag = this._flag_awakeFlag;
        body.m_flag_islandFlag = this._flag_islandFlag;
        body.m_islandIndex = this._islandIndex;
        body.m_sleepTime = this._sleepTime;
        body.m_xf.Copy(this._xf);
        body.m_xf0.Copy(this._xf0);

        // resotre fixture proxy
        const fixtureProxyArray = this._fixtureProxyArray;
        let fixtureIndex = 0;
        for(let fixture = body.m_fixtureList; fixture; fixture = fixture.m_next) {
            const proxyArray = fixtureProxyArray[fixtureIndex];
            fixture.m_proxyCount = this._fixtureProxyCountArray[fixtureIndex];

            fixtureIndex++;

            let proxyIndex = 0;
            for(const fixtureProxy of fixture.m_proxies) {
                fixtureProxy.proxy = proxyArray[proxyIndex++];
            }
        }
    }
}

class ContactMangerBackup {
    private _treeRootNode: any;
    private readonly _moveBuffer = new Array<any>();
    private _moveCount = 0;
    private _contactList: any;

    backup(contactManager: any, nodeMap: Map<any, any>) {
        const broadPhase = contactManager.m_broadPhase;

        // backup tree
        const tree = broadPhase.m_tree;
        const newRoot = treeNodeClone(tree, tree.m_root, nodeMap);
        newRoot.parent = null;
        this._treeRootNode = newRoot;

        // backup move buffer
        this._moveCount = broadPhase.m_moveCount;
        const moveBuffer = broadPhase.m_moveBuffer;
        for(let i = 0; i < broadPhase.m_moveCount; ++i) {
            this._moveBuffer[i] = nodeMap.get(moveBuffer[i]);
        }

        // backup contact list
        this._contactList = createContactListBackup(contactManager, nodeMap);
    }

    restore(contactManager: any) {
        const broadPhase = contactManager.m_broadPhase;

        // restore tree
        const tree = broadPhase.m_tree;
        treeNodeRemove(tree, tree.m_root);
        tree.m_root = this._treeRootNode;
        this._treeRootNode = null;

        // restore move buffer
        broadPhase.m_moveCount = this._moveCount;
        const moveBuffer = broadPhase.m_moveBuffer;
        for(let i = 0; i < this._moveCount; ++i) {
            moveBuffer[i] = this._moveBuffer[i];
        }

        // restore contact list
        restoreContactList(contactManager, this._contactList);
        this._contactList = null;
    }

    clear(contactManager: any) {
        // clear tree
        const broadPhase = contactManager.m_broadPhase;
        const tree = broadPhase.m_tree;
        treeNodeRemove(tree, this._treeRootNode);
        this._treeRootNode = null;

        // clear contact list
        const contactFactory = contactManager.m_contactFactory;
        for(let c = this._contactList; c; c = c.m_next) {
            c.m_manifold.pointCount = 0;
            contactFactory.Destroy(c);
        }
        this._contactList = null;
    }
}


function cloneContact(contactFactory: any, contact: any, edgeMap: Map<any, any>) {
    const contactCloned = contactFactory.Create(
        contact.m_fixtureA, contact.m_indexA, contact.m_fixtureB, contact.m_indexB);
    contactCloned.m_flag_bulletHitFlag = contact.m_flag_bulletHitFlag;
    contactCloned.m_flag_enabledFlag = contact.m_flag_enabledFlag;
    contactCloned.m_flag_filterFlag = contact.m_flag_filterFlag;
    contactCloned.m_flag_islandFlag = contact.m_flag_islandFlag;
    contactCloned.m_flag_toiFlag = contact.m_flag_toiFlag;
    contactCloned.m_flag_touchingFlag = contact.m_flag_touchingFlag;
    contactCloned.m_friction = contact.m_friction;
    contactCloned.m_manifold.Copy(contact.m_manifold);
    contactCloned.m_oldManifold.Copy(contact.m_oldManifold);
    contactCloned.m_restitution = contact.m_restitution;
    contactCloned.m_toi = contact.m_toi;
    contactCloned.m_toiCount = contact.m_toiCount;

    const nodeACloned = contactCloned.m_nodeA;
    const nodeA = contact.m_nodeA;
    nodeACloned.contact = contactCloned;
    nodeACloned.other = nodeA.other;
    nodeACloned.next = nodeA.next;
    nodeACloned.prev = nodeA.prev;
    edgeMap.set(nodeA, nodeACloned);

    const nodeBCloned = contactCloned.m_nodeB;
    const nodeB = contact.m_nodeB;
    nodeBCloned.contact = contactCloned;
    nodeBCloned.other = nodeB.other;
    nodeBCloned.next = nodeB.next;
    nodeBCloned.prev = nodeB.prev;
    edgeMap.set(nodeB, nodeBCloned);

    return contactCloned;
}

const tmpEdgeMap = new Map<any, any>();

function createContactListBackup(contactManager: any, treeNodeMap: Map<any, any>) {
    const { m_contactList: contactList, m_contactFactory: contactFactory } = contactManager;

    if(!contactList) {
        return contactList;
    }

    // clone head
    const contactListBackup = cloneContact(contactFactory, contactList, tmpEdgeMap);
    contactListBackup.m_prev = null;

    // clone tail
    let contact = contactList;
    let contactCloned = contactListBackup;
    while(contact = contact.m_next) {
        const contactCloned1 = cloneContact(contactFactory, contact, tmpEdgeMap);
        contactCloned.m_next = contactCloned1;
        contactCloned1.m_prev = contactCloned;
        contactCloned = contactCloned1;
    }
    contactCloned.m_next = null;

    // link contact edge
    for(contactCloned = contactListBackup; contactCloned; contactCloned = contactCloned.m_next) {
        const nodeA = contactCloned.m_nodeA;
        const nodeB = contactCloned.m_nodeB;

        const nodeAprev = nodeA.prev;
        if(nodeAprev) {
            nodeA.prev = tmpEdgeMap.get(nodeAprev);
        }
        const nodeAnext = nodeA.next;
        if(nodeAnext) {
            nodeA.next = tmpEdgeMap.get(nodeAnext);
        }
        const nodeBprev = nodeB.prev;
        if(nodeBprev) {
            nodeB.prev = tmpEdgeMap.get(nodeBprev);
        }
        const nodeBnext = nodeB.next;
        if(nodeBnext) {
            nodeB.next = tmpEdgeMap.get(nodeBnext);
        }
    }

    tmpEdgeMap.clear();

    return contactListBackup;
}

function destroyContactList(contactList: any, contactFactory: any) {
    for(let c = contactList; c; c = c.m_next) {
        const nodeA = c.m_nodeA;
        const nodeB = c.m_nodeB;
        // if the contact edge is head of m_contactList of body, remove it from body
        if(!nodeA.prev) {
            c.m_fixtureA.m_body.m_contactList = null;
        }
        if(!nodeB.prev) {
            c.m_fixtureB.m_body.m_contactList = null;
        }
        c.m_manifold.pointCount = 0;
        contactFactory.Destroy(c);
    }
}

function restoreContactList(contactManager: any, contactListBackup: any) {
    const { m_contactList: contactList, m_contactFactory: contactFactory } = contactManager;

    // clear old contact list
    destroyContactList(contactList, contactFactory);

    // restore contact list
    contactManager.m_contactList = contactListBackup;
    let contactCount = 0;
    for(let c = contactListBackup; c; c = c.m_next, contactCount++) {
        const nodeA = c.m_nodeA;
        const nodeB = c.m_nodeB;
        // if the contact edge is head of m_contactList, add it to body.m_contactList
        if(!nodeA.prev) {
            c.m_fixtureA.m_body.m_contactList = nodeA;
        }
        if(!nodeB.prev) {
            c.m_fixtureB.m_body.m_contactList = nodeB;
        }
    }
    contactManager.m_contactCount = contactCount;
}

function treeNodeClone(tree: any, node: any, nodeMap: Map<any, any>) {
    if(!node)
        return node;
    const newNode = tree.AllocateNode();
    newNode.aabb.Copy(node.aabb);
    if(node.child1) {
        newNode.child1 = treeNodeClone(tree, node.child1, nodeMap);
        newNode.child1.parent = newNode;
    } else {
        newNode.child1 = null;
    }
    if(node.child2) {
        newNode.child2 = treeNodeClone(tree, node.child2, nodeMap);
        newNode.child2.parent = newNode;
    } else {
        newNode.child2 = null;
    }
    newNode.height = node.height;
    newNode.m_id = node.m_id;
    newNode.userData = node.userData;
    nodeMap.set(node, newNode);
    return newNode;
}

function treeNodeRemove(tree: any, node: any) {
    if(!node)
        return;
    
    const { child1, child2 } = node;
    tree.FreeNode(node);
    treeNodeRemove(tree, child1);
    treeNodeRemove(tree, child2);
}

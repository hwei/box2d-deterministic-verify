import AuthRigidbody from "./AuthRigidbody";
import box2d from './box2dHelper';
import Box2dWorldRollbacker from './Box2dWorldRollbacker'

const PHY_FRAME_RATE = 30;
const MAX_STEP = PHY_FRAME_RATE * 2;

class Entity {
    private readonly _sprite: Laya.Sprite;
    private readonly _bodyDef: Box2D.Dynamics.b2BodyDef;
    private readonly _fixtureDef: Box2D.Dynamics.b2FixtureDef;
    private _body: Box2D.Dynamics.b2Body | undefined;
    
    constructor(sprite: Laya.Sprite, bodyDef: Box2D.Dynamics.b2BodyDef, fixtureDef: Box2D.Dynamics.b2FixtureDef) {
        this._sprite = sprite;
        this._bodyDef = bodyDef;
        this._fixtureDef = fixtureDef;
    }

    updateSprite() {
        const body = this._body;
        if(!body)
            return;

        const phy2pixel = Laya.Physics.PIXEL_RATIO;
        const position = body.GetPosition();
        const angle = body.GetAngle();
        const sprite = this._sprite;
        sprite.x = phy2pixel * position.x;
        sprite.y = phy2pixel * position.y;
        sprite.rotation = Laya.Utils.toAngle(angle);
    }

    craeteBody(world: Box2D.Dynamics.b2World) {
        this._body = world.CreateBody(this._bodyDef);
        this._body.CreateFixture(this._fixtureDef);
    }

    dump() {
        const body = this._body;
        if (!body)
            return '???';
        const pos = body.GetPosition();
        return `${pos.x}, ${pos.y}, ${body.GetAngle()}`;
    }
}


export default class MainScene extends Laya.Scene {
    private readonly _entityArray = new Array<Entity>();
    private _outputText: Laya.Text | undefined;
    private _lastDumpText = '';
    private _worldRollbacker: Box2dWorldRollbacker | undefined;
    private readonly _physicsDebugDraw = new Laya.PhysicsDebugDraw();
    private _dragStartPosX = 0;
    private _dragTouchId: number | undefined;
    private _progressBar = new Laya.Sprite();
    private _wantRollbackStep = 0;

    onEnable() {
        for(let i = 0; i < this.numChildren; ++i) {
            const c = this.getChildAt(i);
            const a = c.getComponent(AuthRigidbody) as AuthRigidbody | undefined;
            const pixel2phy = 1 / Laya.Physics.PIXEL_RATIO;
            if(a) {
                const sprite = c as Laya.Sprite;
                const bodyDef = new box2d.b2BodyDef();
                if(a.isStatic) {
                    bodyDef.type = box2d.b2BodyType.b2_staticBody;
                } else {
                    bodyDef.type = box2d.b2BodyType.b2_dynamicBody;
                }
                bodyDef.position.Set(pixel2phy * sprite.x, pixel2phy * sprite.y);
                bodyDef.angle = Laya.Utils.toRadian(sprite.rotation);

                const shape = new box2d.b2PolygonShape();
                shape.SetAsBox(pixel2phy * 0.5 * sprite.width, pixel2phy * 0.5 * sprite.height);
                const fixtureDef = new box2d.b2FixtureDef();
                fixtureDef.shape = shape;
                fixtureDef.density = 1;
                fixtureDef.friction = 0.3;

                this._entityArray.push(new Entity(sprite, bodyDef, fixtureDef)); 
            } else if (c instanceof Laya.Text) {
                this._outputText = c as Laya.Text;
            }
        }

        this.stage.on(Laya.Event.MOUSE_DOWN, this, this._onMouseDown);
        this.stage.on(Laya.Event.MOUSE_MOVE, this, this._onMouseMove);
        this.stage.on(Laya.Event.MOUSE_UP, this, this._onMouseUp);
        this.stage.addChild(this._progressBar);
        this.stage.addChild(this._physicsDebugDraw);
        this._newWorld();
    }

    private _newWorld() {
        const gravity = new box2d.b2Vec2(0, 10);
        const world = new box2d.b2World(gravity, false);
        for(const entity of this._entityArray) {
            entity.craeteBody(world);
        }
        this._worldRollbacker = new Box2dWorldRollbacker(world);
        this._worldRollbacker.clearBackupOnRollback = false;
        this.timerLoop(1000 / PHY_FRAME_RATE, this, this._update, undefined, true);

        var debug = this._physicsDebugDraw;
        debug.world = world;
        debug.world.SetDebugDraw(debug);
        debug.zOrder = 1000;
        debug.m_drawFlags = 99;
    }

    private _phyReset() {
        // const dumpLines = new Array<string>();

        // for(const entity of this._entityArray) {
        //     dumpLines.push(entity.dump());
        // }

        // this._lastDumpText = dumpLines.join('\n');

        this._newWorld();
    }

    private _phyUpdate(worldRollbacker: Box2dWorldRollbacker) {

        const fromStep = Math.max(0, worldRollbacker.currentStep - 8);
        const targetStep = worldRollbacker.currentStep + 1;

        // restore to fromFrame
        worldRollbacker.rollbackTo(fromStep);

        // step to targetFrame
        let stepCount = 0;
        for(let i = fromStep; i < targetStep; ++i) {
            worldRollbacker.step(1 / PHY_FRAME_RATE);
            stepCount++;
        }
        // console.log('targetStep', targetStep, 'fromFrame', fromStep, 'stepCount', stepCount);
    }

    private _update() {
        const worldRollbacker = this._worldRollbacker;
        if(!worldRollbacker)
            return;

        const progressScale = this.stage.width / MAX_STEP;
        this._progressBar.graphics.clear();

        if (this._wantRollbackStep === 0) {
            if(worldRollbacker.currentStep === MAX_STEP) {
                this._newWorld();
            } else {
                worldRollbacker.step(1 / PHY_FRAME_RATE);
                // this._phyUpdate(worldRollbacker);
            }
    
            for(const entity of this._entityArray) {
                entity.updateSprite();
            }

            if (worldRollbacker.currentStep === 30) {
                const dumpLines = new Array<string>();
                dumpLines.push('dump body on step 30:')
                for(const entity of this._entityArray) {
                    dumpLines.push(entity.dump());
                }
                this._lastDumpText = dumpLines.join('\n');
            }

            this._progressBar.graphics.drawRect(
                (worldRollbacker.currentStep - worldRollbacker.backupCount) * progressScale,
                0, worldRollbacker.backupCount * progressScale, 20, '#80ff00');
        } else {
            this._progressBar.graphics.drawRect(
                (worldRollbacker.currentStep - worldRollbacker.backupCount) * progressScale,
                0, (worldRollbacker.backupCount - this._wantRollbackStep) * progressScale, 20, '#ff8000');
        }

        if(this._outputText)
            this._outputText.text = `${worldRollbacker.currentStep}\n${this._lastDumpText}`;
    }

    private _onMouseDown(e: Laya.Event) {
        if(this._dragTouchId)
            return;

        this._dragTouchId = e.touchId;
        this._dragStartPosX = e.stageX;
    }
    private _onMouseMove(e: Laya.Event) {
        if(this._dragTouchId !== e.touchId)
            return;
        
        let wantRollbackStep = Math.floor((this._dragStartPosX - e.stageX) / this.stage.width * MAX_STEP);
        if(wantRollbackStep < 1) {
            wantRollbackStep = 1;
        } else if (this._worldRollbacker && wantRollbackStep > this._worldRollbacker.backupCount) {
            wantRollbackStep = this._worldRollbacker.backupCount;
        }
        this._wantRollbackStep = wantRollbackStep;
    }
    private _onMouseUp(e: Laya.Event) {
        if(this._dragTouchId !== e.touchId)
            return;

        this._dragTouchId = undefined;
        const worldRollbacker = this._worldRollbacker;
        if(worldRollbacker)
            worldRollbacker.rollbackBy(this._wantRollbackStep);
        this._wantRollbackStep = 0;
        this._lastDumpText = '';
    }
}

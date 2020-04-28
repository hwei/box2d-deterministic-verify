import AuthRigidbody from "./AuthRigidbody";
import box2d from './box2dHelper';

const PHY_TO_PIXEL = 64;
const PIXEL_TO_PHY = 1 / 64;
const VELOCITY_ITERATIONS = 8;
const POSITION_ITERATIONS = 3;
const PHY_FRAME_RATE = 30;

interface Entity {
    sprite: Laya.Sprite;
    body: Box2D.Dynamics.b2Body;
    initBodyDef: Box2D.Dynamics.b2BodyDef;
}

export default class MainScene extends Laya.Scene {
    private _box2dWorld: Box2D.Dynamics.b2World;
    private _entityArray = new Array<Entity>();
    private _frameCount = 0;
    private _outputText: Laya.Text | undefined;
    private _lastDumpText = '';

    constructor() {
        super();
        const gravity = new box2d.b2Vec2(0, 10);
        this._box2dWorld = new box2d.b2World(gravity, true);
    }

    onEnable() {
        for(let i = 0; i < this.numChildren; ++i) {
            const c = this.getChildAt(i);
            const a = c.getComponent(AuthRigidbody) as AuthRigidbody | undefined;

            if(a) {
                const sprite = c as Laya.Sprite;
                const bodyDef = new box2d.b2BodyDef();
                if(a.isStatic) {
                    bodyDef.type = box2d.b2BodyType.b2_staticBody;
                } else {
                    bodyDef.type = box2d.b2BodyType.b2_dynamicBody;
                }
                bodyDef.position.Set(PIXEL_TO_PHY * sprite.x, PIXEL_TO_PHY * sprite.y);
                bodyDef.angle = Laya.Utils.toRadian(sprite.rotation);
                const body = this._box2dWorld.CreateBody(bodyDef);

                const shape = new box2d.b2PolygonShape();
                shape.SetAsBox(PIXEL_TO_PHY * 0.5 * sprite.width, PIXEL_TO_PHY * 0.5 * sprite.height);
                const fixtureDef = new box2d.b2FixtureDef();
                fixtureDef.shape = shape;
                fixtureDef.density = 1;
                fixtureDef.friction = 0.3;
                body.CreateFixture(fixtureDef);

                this._entityArray.push({
                    sprite,
                    body,
                    initBodyDef: bodyDef
                })
            } else if (c instanceof Laya.Text) {
                this._outputText = c as Laya.Text;
            }
        }

        this.timerLoop(1000 / PHY_FRAME_RATE, this, this._update);
    }

    private _update() {
        if(this._frameCount == PHY_FRAME_RATE) {
            // reset
            
            const outputLines = new Array<string>();
            for(const { body, initBodyDef } of this._entityArray) {
                const position = body.GetPosition();
                const angle = body.GetAngle();
                outputLines.push(`position: ${position.x} ${position.y}, angle: ${angle}`);
                body.SetPosition(initBodyDef.position);
                body.SetAngle(initBodyDef.angle);
                body.SetLinearVelocity(initBodyDef.linearVelocity);
                body.SetAngularVelocity(initBodyDef.angularVelocity);
                body.SetAwake(true);
            }
            this._lastDumpText = outputLines.join('\n');
            if(this._outputText)
                this._outputText.text = `${this._frameCount}\n${this._lastDumpText}`;

            this._frameCount = 0;

            return;
        }

        this._box2dWorld.Step(1 / PHY_FRAME_RATE, VELOCITY_ITERATIONS, POSITION_ITERATIONS);
        this._frameCount++;

        for(const { body, sprite } of this._entityArray) {
            const position = body.GetPosition();
            const angle = body.GetAngle();
            sprite.x = PHY_TO_PIXEL * position.x;
            sprite.y = PHY_TO_PIXEL * position.y;
            sprite.rotation = Laya.Utils.toAngle(angle);
        }

        if(this._outputText)
            this._outputText.text = `${this._frameCount}\n${this._lastDumpText}`;
    }
}

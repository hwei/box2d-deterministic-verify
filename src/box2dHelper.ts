
class box2d {
    readonly b2Vec2 = Box2D.Common.Math.b2Vec2;
    readonly b2Transform = Box2D.Common.Math.b2Transform;
    readonly b2Mat22 = Box2D.Common.Math.b2Mat22;
    readonly b2AABB = Box2D.Collision.b2AABB;
    readonly b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape;
    readonly b2World = Box2D.Dynamics.b2World;
    readonly b2BodyDef = Box2D.Dynamics.b2BodyDef;
    readonly b2FixtureDef = Box2D.Dynamics.b2FixtureDef;
    readonly b2Sweep = Box2D.Common.Math.b2Sweep;
    readonly b2BodyType = { b2_staticBody: 0, b2_kinematicBody: 1,  b2_dynamicBody: 2 }
}

export default (window as any).box2d as box2d;

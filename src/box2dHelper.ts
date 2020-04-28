
class box2d {
    readonly b2Vec2 = Box2D.Common.Math.b2Vec2;
    readonly b2World = Box2D.Dynamics.b2World;
    readonly b2BodyDef = Box2D.Dynamics.b2BodyDef;
    readonly b2BodyType = { b2_staticBody: 0, b2_kinematicBody: 1,  b2_dynamicBody: 2 }
    readonly b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape;
    readonly b2FixtureDef = Box2D.Dynamics.b2FixtureDef;
}

export default (window as any).box2d as box2d;

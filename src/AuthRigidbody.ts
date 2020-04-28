export default class AuthRigidbody extends Laya.Component {
    /** @prop {name:isStatic, tips:"是否静态", type:Bool, default:true}*/
    isStatic: boolean;

    constructor() {
        super();
        this.isStatic = true;
    }
}

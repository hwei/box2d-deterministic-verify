Box2d Deterministic Verify
=========

This project is for verifying whether Box2d in Laya game engine (ver 2.6.0) is deterministic.


Method
------

1. Initialize some dynamic boxes and step the world.
2. After 60 steps, record their positions and angles.
3. Reset these boxes and step the world again. Goto step 2.

Conclusion
------

YES. It is deterministic.

The results are also consistent in Windows Chrome and iOS WeChat App.


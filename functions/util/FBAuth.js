const {admin, db} = require('./admin');
module.exports =  (req, res, next) => {
    let idToken;
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer ')){
        idToken = req.headers.authorization.split('Bearer ')[1];
    }
    else{
        console.error('no token');
        return res.status(403).json({error: 'Unauthorized'})
    }

    admin.auth().verifyIdToken(idToken).then((decodedToken) => {
        req.user = decodedToken;
        return db.collection('users').where('userId', '==', req.user.uid).limit(1).get();
    }).then((data) => {
        req.user.userHandle = data.docs[0].data().userHandle;
        req.user.userImage = data.docs[0].data().imageUrl;
        return next();
    }).catch(err => {
        console.error('error while verifying');
        return res.status(400).json(err)
    })
}

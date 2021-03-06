const { db, admin }  = require('../util/admin');
const firebase = require('firebase');
const {firebaseConfig} = require('../util/config');
const uuid = require('uuid');

exports.getAllBlogs =  (req, res) => {
    db.collection(`blogs`).orderBy('createdAt', 'desc').get().then((snapshot) => {
        let allBlogs = [];
        snapshot.docs.forEach(doc => {
            allBlogs.push({
                id: doc.id,
                ...doc.data()
            });
        });
        return res.send(allBlogs);
    });

};

exports.editBlog = (req,res) => {

  db.doc(`blogs/${req.params.blogId}`).update({
    ...req.body
  }).then(()=>{
      return res.json({message: 'details added successfully'})
  }).catch(err => {
      console.error(err);
      return res.status(401).json({error: "something happened"})
  })
}



exports.addOneBlog = (req, res) => {
  const path = require('path');
  const os = require('os');
  const fs = require('fs');
  let imageToBeUploaded = {};
  let imageFileName;
  let newBlog = {};
  if(req.method !== 'POST'){
      return res.status(400).json({error: 'method not allowed'});
  }
  const {
    fieldname,
    originalname,
    encoding,
    mimetype,
    buffer,
  } = req.files[0]

  console.log(originalname);
  if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
    return res.status(400).json({ error: 'Wrong file type submitted' });
  }
  console.log(uuid());
  const imageExtension = originalname.split('.')[originalname.split('.').length - 1];
  imageFileName = `${uuid()}.${imageExtension}`;
  const filepath = path.join(os.tmpdir(), imageFileName);
  imageToBeUploaded = { filepath, mimetype };
  fs.writeFile(filepath, buffer, (err) => {
  if(!err) console.log('Data written');
});
  console.log(buffer)
  admin
    .storage()
    .bucket()
    .upload(imageToBeUploaded.filepath, {
      resumable: false,
      metadata: {
        metadata: {
          contentType: imageToBeUploaded.mimetype
        }
      }
    })
    .then(() => {
      imageUrl = `https://firebasestorage.googleapis.com/v0/b/${
        firebaseConfig.storageBucket
      }/o/${imageFileName}?alt=media`;
      newBlog = {
          title: req.body.title,
          description: req.body.description,
          userHandle: req.user.userHandle,
          createdAt: new Date().toISOString(),
          likeCount: 0,
          commentCount: 0,
          imageUrl: imageUrl
    }
    return db.collection(`blogs`).add(newBlog);
  }).
    then((doc) => {
        return res.json({
          ...newBlog,
          id: doc.id
        });
    }).catch((err) => {
        res.status(500).json({error: 'something went wrong'});
        console.error(err);
    })
}


exports.getOneBlog = (req, res) => {
    let blog = {};
    db.doc(`blogs/${req.params.id}`).get().then((doc) => {
        if(!doc.exists){
            return res.status(500).json({error: "doc doesnt exist"});
        }
        blog.data = doc.data();
        blog.blogId = doc.id;
        return db.collection('comments').where('blogId', '==', req.params.id).get();
    }).then((docs) => {
        let comments = [];
            docs.forEach(doc =>{
                comments.push(doc.data());
            });
            blog.comments = comments;
            res.json(blog);
    }).catch(err => {
        console.error(err);
        return res.status(500).json({error: "something happened"});

    })
};

exports.getComments = (req, res) => {
  let comments = [];
  db.collection('comments').where('blogId', '==', req.params.id).get().then(data => {
    data.forEach(doc => {
      comments.push({
        id: doc.id,
        ...doc.data()
      });
    });
    return res.send(comments);
  }).catch(err => {
      console.error(err);
      return res.status(500).json({error: "something happened"});
  })
}

exports.commentOnBlog = (req, res) => {
    if(req.body.comment.trim() === ''){
        return res.status(400).json({error: "must not be empty"});
    }
    const comment = {
        body: req.body.comment,
        createdAt: new Date().toISOString(),
        blogId: req.params.blogId,
        userHandle: req.user.userHandle,
        userImage:req.user.userImage
    };

    console.log(comment);
    db.doc(`blogs/${req.params.blogId}`).get().then((doc) => {
        if(!doc.exists){
            return res.status(400).json({error: "The blog doesn't exist anymore!"})
        }
        return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
    }).then(() => {
        return db.collection('comments').add(comment)
    }).then( () => {
        res.json(comment);
    }).catch(err => {
        return res.status(500).json({error: "error while adding the comment" + err})
    })
}
exports.checkLike = (req, res) => {
  db.collection('likes').where('userHandle', '==', req.user.userHandle)
  .where('blogId', '==', req.params.blogId).get().then(data => {
    if(data.empty){
      return res.send(false);
    }
    else{
      return res.send(true);
    }
  }).catch((err) => {
    console.error(err);
    res.status(500).json({ error: err.code });
  });
}
exports.likeOnBlog = (req, res) => {
    const likeDoc = db.collection('likes')
    .where('userHandle', '==', req.user.userHandle)
    .where('blogId', '==', req.params.blogId);

    const blogDoc = db.doc(`blogs/${req.params.blogId}`);

    let blogData = {};

    blogDoc.get().then(doc => {
        if(doc.exists){
            blogData = doc.data();
            blogData.blogId = doc.id;
            return likeDoc.get();
        }
        else{
            return res.status(500).json({error: "The blog doesnt exist anymore"});
        }

    }).then((data) => {
        if(data.empty){
            return db.collection('likes').add({
                blogId: blogData.blogId,
                userHandle: req.user.userHandle
            }).then(() => {
                blogData.likeCount++;
                return blogDoc.update({likeCount: blogData.likeCount});
            }).then(() => {
                return res.json(blogData);
              });
          }
        else {
            return res.status(400).json({ error: 'blog already liked' });
          }
        })
        .catch((err) => {
          console.error(err);
          res.status(500).json({ error: err.code });
        });
        };


exports.unlikeOnBlog = (req, res) => {
    const likeDocument = db
        .collection('likes')
        .where('userHandle', '==', req.user.userHandle)
        .where('blogId', '==', req.params.blogId)
        .limit(1);

    const blogDocument = db.doc(`/blogs/${req.params.blogId}`);

    let blogData;

    blogDocument
        .get()
        .then((doc) => {
        if (doc.exists) {
            blogData = doc.data();
            blogData.blogId = doc.id;
            return likeDocument.get();
        } else {
            return res.status(404).json({ error: 'blog not found' });
        }
        })
        .then((data) => {
        if (data.empty) {
            return res.status(400).json({ error: 'blog not liked' });
        } else {
            return db
            .doc(`/likes/${data.docs[0].id}`)
            .delete()
            .then(() => {
                blogData.likeCount--;
                return blogDocument.update({ likeCount: blogData.likeCount });
            })
            .then(() => {
                res.json(blogData);
            });
        }
        })
        .catch((err) => {
        console.error(err);
        res.status(500).json({ error: err.code });
        });
    };


exports.deleteBlog = (req, res) => {
    db.doc(`blogs/${req.params.blogId}`).get().then(doc => {
        if(doc.exists){
            if(doc.data().userHandle === req.user.userHandle)
                doc.ref.delete().then(() => {
                    return res.status(200).json({success:`deleted ${doc.data().title}`});
                })
            else{
                res.status(400).json({error: 'unauthorized'})
            }
        }
        else{
            res.status(400).json({error: 'blog doesnt exist'})
        }
    }).catch((err) => {
        console.error(err);
        res.status(500).json({ error: err.code });
        });
}

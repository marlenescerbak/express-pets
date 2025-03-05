const { ObjectId } = require("mongodb")
const sanitizeHtml = require("sanitize-html")
const petsCollection = require("../db").db().collection("pets")
const contactsCollection = require("../db").db().collection("contacts")
const nodemailer = require("nodemailer")
const validator = require("validator")

const sanitizeOptions = {
  allowedTags: [],
  allowedAttributes: {}
}

exports.submitContact = async function (req, res, next) {
  if (req.body.spamTest.toUpperCase() !== "PUPPY") {
    console.log("spam detected")
    return res.json({ message: "denied" })
  }

  if (typeof req.body.name != "string") {
    req.body.name = ""
  }
  if (typeof req.body.email != "string") {
    req.body.name = ""
  }
  if (typeof req.body.comment != "string") {
    req.body.name = ""
  }

  if (!validator.isEmail(req.body.email)) {
    console.log("invalid email")
    return res.json({ message: "Not a valid email" })
  }

  if (!ObjectId.isValid(req.body.petID)) {
    console.log("invalid id detected")
    return res.json({ message: "denied" })
  }

  req.body.petID = new ObjectId(req.body.petID)
  const doesPetExist = await petsCollection.findOne({ _id: req.body.petID })
  if (!doesPetExist) {
    console.log("pet does not exist")
    return res.json({ message: "denied" })
  }

  const theObject = {
    petID: req.body.petID,
    name: sanitizeHtml(req.body.name, sanitizeOptions),
    email: sanitizeHtml(req.body.email, sanitizeOptions),
    comment: sanitizeHtml(req.body.comment, sanitizeOptions)
  }

  console.log(theObject)

  var transport = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
      user: process.env.MAILTRAPUSERNAME,
      pass: process.env.MAILTRAPPASSWORD
    }
  })

  try {
    const promise1 = transport.sendMail({
      to: theObject.email,
      from: "petadotion@localhost",
      subject: `Thank you for your interest in ${doesPetExist.name}!`,
      html: `<h3 style="color: purple; font-size: 30px; font-weight: normal">
      Thank you!
      </h3>
      <p>We appreciate your interest in ${doesPetExist.name}. Below is a copy of the message you sent us for your personal records:</p>
      <p><em>${theObject.comment}</em></p>`
    })

    const promise2 = transport.sendMail({
      to: "petadotion@localhost",
      from: "petadotion@localhost",
      subject: `Someone is interested in ${doesPetExist.name}!`,
      html: `<h3 style="color: purple; font-size: 30px; font-weight: normal">
      New Contact
      </h3>
      <p>Name: ${theObject.name}<br>
      Pet of interest: ${doesPetExist.name}<br>
      Email: ${theObject.email}<br>
      Message: ${theObject.comment}</p>`
    })

    const promise3 = await contactsCollection.insertOne(theObject)

    await Promise.all([promise1, promise2, promise3])
  } catch (err) {
    next(err)
  }

  res.send("Thanks for sending data")
}

exports.viewPetContacts = async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    console.log("bad id")
    return res.redirect("/")
  }
  const pet = await petsCollection.findOne({ _id: new ObjectId(req.params.id) })
  if (!pet) {
    console.log("pet does not exist")
    return res.redirect("/")
  }
  const contacts = await contactsCollection.find({ petID: new ObjectId(req.params.id) }).toArray()
  res.render("pet-contacts", { contacts, pet })
}
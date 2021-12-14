import User from '../user/User.js'
import Entry from '../user/Entry.js'
import Layout from '../user/Layout.js'
import DocumentationAlias from '../user/DocumentationAlias.js'
import Praxis from '../user/Praxis.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import config from '../config.js'
import xl from 'excel4node'
import nodemailer from 'nodemailer'
import express from 'express'

let router = express.Router();
import bodyParser from 'body-parser'
import _ from 'lodash'
import multer from 'multer'
import {v4 as uuidv4} from 'uuid';
import {isAlphaString} from '../utils/customValidators.js'
import mongoose from 'mongoose'
import fetch from "node-fetch";
import {createMollieClient} from '@mollie/api-client';

router.use(bodyParser.urlencoded({extended: false}));
router.use(bodyParser.json());
import {check, validationResult, header, body, query} from 'express-validator'
import UserPayment from "../user/UserPayment.js";

const mollieClient = createMollieClient({apiKey: 'test_pKcxvFFTCDKpHqryH8fWfeAbvs9DRN'});


let selfSignedConfig = {
    host: 'localhost',
    port: 465,
    secure: false, // use TLS
    tls: {
        rejectUnauthorized: false
    }
};
let transporter = nodemailer.createTransport(selfSignedConfig);

const validationErrorStripper = ({location, msg, param, value, nestedErrors}) => {
    return `${msg}`;
};

const trimUser = (user, requestingUser = null) => {
    let userObj = {
        _id: user._id,
        entries: user.entries.length,
        firstName: user.firstName,
        name: user.name,
        email: user.email,
        residence: user.residence,
        job: user.job,
        created: user.created,
        yearOfBirth: user.yearOfBirth,
        note: user.note,
        diagnose: user.diagnose,
        layouts: user.layouts
    }
    //TODO permissions for note and diagnose?? Still needed with only 1 consultant?
    if (requestingUser) {
        ///folgende Felder nur Füllen wenn für eigenen Nutzer angefragt
        if (requestingUser._id === user._id) {
            userObj["scopes"] = user.scopes;
            userObj["flags"] = user.flags;
            // userObj["registerCounter"] = user.registerCounter;
        }
        //oder eben vom admin
        if (requestingUser.scopes.includes("admin")) {
            userObj["scopes"] = user.scopes;
            userObj["flags"] = user.flags;
        }
        if (requestingUser.scopes.includes("consultant")) {
            userObj["flags"] = user.flags;
        }
    }
    return (userObj);
}

const saveErrorWrapper = (err) => {
    let newErr = err;
    if (typeof err.toJSON === 'function') {
        newErr = err.toJSON();
        if (newErr.op) {
            delete newErr.op
        }
    }
    return newErr;
};

let storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads')
    },
    filename: function (req, file, cb) {
        let myId = uuidv4();
        let extArray = file.mimetype.split("/");
        let extension = extArray[1];
        cb(null, myId + '.' + extension)
    }
});

let fileFilter = (req, file, cb) => {
    // To reject this file pass `false`, like so:
    let extArray = file.mimetype.split("/");
    // let type = extArray[0];
    let extension = extArray[1];
    if (extension !== "jpeg" && extension !== "png") return cb(null, false);
    return cb(null, true);
};

let imageUpload = multer({storage: storage, fileFilter: fileFilter});

//eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjVkMDBlNTllNjgyYmFkMzY2Y2ExNzE3MCIsInNjb3BlcyI6WyJ1c2VyIiwiYWRtaW4iXSwiaWF0IjoxNTYwMzM5ODcyLCJleHAiOjE1NjAzNTQyNzJ9.nr5N58BQoKt-KbRkVMMq5bNYgNbBws6J5s1ZUccvPLU
router.post('/createBootstrap', async (req, res) => {
    if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "setup") {
        let hashedPassword = bcrypt.hashSync("bootstrap", 8);
        let user = new User({
            firstName: "Tim",
            name: "Fröhlich",
            email: "timmiFroehlich@web.de",
            yearOfBirth: req.body.yearOfBirth,
            residence: "bootstrap",
            job: "bootstrap",
            password: hashedPassword,
            scopes: ["user", "admin"],
            flags: [],
        });
        try {
            await user.save();
        } catch (err) {
            return res.status(500).send(saveErrorWrapper(err));
        }
        let refreshToken = jwt.sign({id: user._id}, config.secret, {});
        let accessToken = jwt.sign({id: user._id, scopes: user.scopes}, config.secret, {
            expiresIn: 14400 // expires in
        });
        accessToken = user.flags.includes("invalid") ? null : accessToken;
        accessToken = user.flags.includes("changePW") ? null : accessToken;
        return res.status(200).send({
            auth: true,
            refreshToken: refreshToken,
            accessToken: accessToken,
            password: "bootstrap",
            flags: user.flags
        });
    } else {
        return res.status(404).send({});
    }
});

router.post('/registerTherapist', [
    body('lastname')
        .trim()
        .exists({checkNull: true}).withMessage("NoName"),
    body('firstname')
        .trim()
        .exists({checkNull: true}).withMessage("NoFirstName"),
    body('email')
        .trim().normalizeEmail()
        .exists({checkNull: true}).withMessage("NoEmail")
        .isEmail().withMessage("InvalidEmail"),
    body('password')
        .trim().normalizeEmail()
        .exists({checkNull: true}).withMessage("NoPassword")
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }
    let fullname = req.body.firstname + " " + req.body.lastname;
    // const options = {
    //     body: JSON.stringify({
    //         name: fullname,
    //         email: req.body.email
    //     }),
    //     method: 'POST',
    //     headers: {
    //         'Content-Type': 'application/json',
    //         'Authorization': 'Bearer test_eyapB6bkn8P3jzNJ8N9PebPhhBJDj3'
    //     },
    // };
    //
    // // try {
    // const response = await fetch('https://api.mollie.com/v2/customers', options);
    // const paymentUser = await response.json();

    const customer = await mollieClient.customers.create({
        name: fullname,
        email: req.body.email
    })

    let randomstring = Math.random().toString(36).slice(-8);
    let hashedPassword = bcrypt.hashSync(randomstring, 8);
    let user = new User({
        firstName: req.body.firstname,
        name: req.body.lastname,
        email: req.body.email,
        yearOfBirth: req.body.yearOfBirth,
        residence: req.body.residence,
        job: req.body.job,
        password: hashedPassword,
        scopes: ["user", "consultant"],
        flags: ["changePW"],
        consultants: [],
    });
    try {
        user = await user.save();
    } catch (err) {
        return res.status(500).send(saveErrorWrapper(err));
    }

    let userPayment = new UserPayment({
        user: user._id,
        customerId: customer.id
    })
    try {
        userPayment = await userPayment.save();
    } catch (err) {
        return res.status(500).send(saveErrorWrapper(err));
    }

    user.userPayment = userPayment._id;
    try {
        user = await user.save();
    } catch (err) {
        return res.status(500).send(saveErrorWrapper(err));
    }

    const payment = await mollieClient.payments.create({
        amount: {currency: "EUR", value: "20.00"},
        customerId: customer.id,
        sequenceType: "first",
        description: "First payment",
        redirectUrl: "https://www.staycom.deimach.de/account/login",
        webhookUrl: "https://deimach.de:3115/api/paymentStatus"
    })

    userPayment.paymentId = payment.id;
    userPayment.paymentStatus = true;
    try {
        userPayment = await userPayment.save();
    } catch (err) {
        return res.status(500).send(saveErrorWrapper(err));
    }
    let returnBody = {
        ...userPayment,
        checkout: payment._links.checkout.href
    }
    return res.status(200).send(returnBody);
});

router.post("/paymentStatus", [
    body('id')
        .trim()
        .exists({checkNull: true}).withMessage("NoID"),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }
    let payment = await mollieClient.payments.get(req.body.id)
    if (payment.status !== "paid") {
        let userPayment = await UserPayment.findOne({
            paymentId: req.body.id
        });
        userPayment.paymentStatus = false;
        try {
            userPayment = await userPayment.save();
        } catch (err) {
            return res.status(500).send(saveErrorWrapper(err));
        }
        return res.status(200).send(userPayment);
    }
    let userPayment = await UserPayment.findOne({
        paymentId: req.body.id
    });
    const mandates = await mollieClient.customers_mandates.all({
        customerId: userPayment.customerId,
    });
    if (!mandates || mandates.length > 1) {
        return res.status(500).send({error: "Critical payment error"});
    }
    const mandate = mandates[0];
    if (mandate.status === "pending" || mandate.status === "valid") {
        userPayment.mandateId = mandates[0].id;
        try {
            userPayment = await userPayment.save();
        } catch (err) {
            return res.status(500).send(saveErrorWrapper(err));
        }
        const today = new Date();
        const nextMonth = new Date(today.setMonth(today.getMonth() + 1));
        let formatDate = nextMonth.toISOString().split('T')[0]
        let subscription = await mollieClient.customers_subscriptions.create({
            customerId: userPayment.customerId,
            amount: {value: '20.00', currency: 'EUR'},
            interval: '1 months',
            startDate: formatDate,
            description: 'Monthly Payment',
            webhookUrl: 'https://deimach.de:3115/api/subscriptionStatus',
        });
        userPayment.subscriptionId = subscription.id;
        userPayment.paymentStatus = true;
        try {
            userPayment = await userPayment.save();
        } catch (err) {
            return res.status(500).send(saveErrorWrapper(err));
        }
    }
    return res.status(200).send(userPayment);
});

router.post("/subscriptionStatus", [
    body('id')
        .trim()
        .exists({checkNull: true}).withMessage("NoID"),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }
    let payment = await mollieClient.payments.get(req.body.id)
    if (!payment || !payment.customerId || !payment.subscriptionId) return res.status(500).send({});
    let userPayment;
    try {
        userPayment = await UserPayment.findOne({
            customerId: payment.customerId
        });
    } catch {
        return res.status(500).send({})
    }
    if (!userPayment || !userPayment.paymentId || !userPayment.customerId) return res.status(500).send({});
    let subscription;
    try {
        subscription = await mollieClient.customerSubscriptions.get(userPayment.paymentId, {
            customerId: userPayment.customerId,
        });
    } catch {
        return res.status(500).send({})
    }
    if (!subscription || !subscription.status) return res.status(500).send({});
    userPayment.paymentStatus = subscription.status === "active";
    try {
        userPayment = await userPayment.save();
    } catch (err) {
        return res.status(500).send(saveErrorWrapper(err));
    }
    return res.status(200).send(userPayment);
});

async function getPaymentStatus(user) {
    if (user.scopes.includes("admin")) return true;
    if (user.userPayment) {
        let userPaymentId;
        if (user.userPayment._id) {
            userPaymentId = user.userPayment._id;
        } else {
            userPaymentId = user.userPayment;
        }
        let userPayment;
        try {
            userPayment = await UserPayment.findById(userPaymentId);
        } catch (err) {
            return false;
        }
        if (!userPayment || !userPayment.customerId || !userPayment.subscriptionId) return false;
        return userPayment.paymentStatus;
    } else {
        return true;
    }
}


router.post('/registerConsultant', [
    header('x-access-token')
        .exists({checkNull: true}).withMessage("NoAccessToken"),
    body('name')
        .trim()
        .exists({checkNull: true}).withMessage("NoName"),
    body('firstName')
        .trim()
        .exists({checkNull: true}).withMessage("NoFirstName"),
    body('email')
        .trim().normalizeEmail()
        .exists({checkNull: true}).withMessage("NoEmail")
        .isEmail().withMessage("InvalidEmail"),
    body('yearOfBirth')
        .trim()
        .isNumeric().withMessage("InvalidYoB")
        .isLength({min: 4, max: 4}).withMessage("InvalidYoB")
        .optional(),
    body('residence')
        .trim()
        .custom(isAlphaString).withMessage("InvalidResidence")
        .optional(),
    body('job')
        .trim()
        .custom(isAlphaString).withMessage("InvalidJob")
        .optional(),
    // body('registerCounter')
    //     .trim()
    //     .optional()
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }

    let accessToken = req.headers['x-access-token'];
    let decoded;
    try {
        decoded = await jwt.verify(accessToken, config.secret);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    if (!decoded.id || !decoded.scopes.includes("admin")) return res.status(403).send(["InvalidAccessToken"]);


    let randomstring = Math.random().toString(36).slice(-8);
    let hashedPassword = bcrypt.hashSync(randomstring, 8);

    // let registerCounter = 0;
    // if (req.body.hasOwnProperty("registerCounter") && req.body.registerCounter >= 0) {
    //     registerCounter = req.body.registerCounter;
    // }

    let consultant;
    try {
        consultant = await User.findById(decoded.id);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }

    let user = new User({
        firstName: req.body.firstName,
        name: req.body.name,
        email: req.body.email,
        yearOfBirth: req.body.yearOfBirth,
        residence: req.body.residence,
        job: req.body.job,
        password: hashedPassword,
        scopes: ["user", "consultant"],
        flags: ["changePW"],
        consultants: decoded.scopes.includes("admin") ? [] : [consultant._id],
        // registerCounter: registerCounter,
    });
    try {
        user = await user.save();
    } catch (err) {
        if (err.code === 11000) {
            try {
                user = await User.findOne({
                    email: req.body.email
                });
            } catch (err) {
                return res.status(500).send({});
            }
            if (!decoded.scopes.includes("admin")) {
                user.consultants.addToSet(consultant._id);
            }
            try {
                user = await user.save();
            } catch (err) {
                return res.status(500).send({})
            }
        } else {
            return res.status(500).send({});
        }
    }

    if (!decoded.scopes.includes("admin")) {
        consultant.users.addToSet(user);
        // consultant.registerCounter = consultant.registerCounter - 1;
        try {
            consultant = await consultant.save();
        } catch (err) {
            return res.status(500).send(saveErrorWrapper(err))
        }
    }
    //Mail an Consultant
    let mailOptions = {

        from: '"Deimach" <support@deimach.de>',
        to: req.body.email, // list of receivers
        subject: 'Willkommen bei StayCom!', // Subject line
        text: 'Hallo ' + user.firstName + " " + user.name + "," +
            '\n\nDu wurdest von Timo Gross bei Staycom registriert.\n' +
            '\nUm zu starten, klicke bitte auf den untenstehenden Link und lege ein persönliches Passwort fest.\n' +
            //'\nUm zu starten, melden Sie sich bitte in der App mit den untenstehenden Anmeldedaten an.\n' +
            '\nWichtig! Geben Sie niemals Ihr Passwort weiter!\n' +
            '\nhttps://www.staycom.deimach.de/complete-registration/' + req.body.email + "/" + randomstring + "\n" +
            '\n\nAlternativ kannst du dein Passwort auch in der App festlegen, indem du dich mit folgenden Anmeldedaten einloggst: \n' +
            '\nE-Mail: ' + req.body.email + "\n" +
            '\nPasswort: ' + randomstring + '\n\n' +
            '\nApp nocht nicht Installiert? Hier downloaden!\n' +
            '\nAndroid: https://play.google.com/store/apps/details?id=com.deimach.staycom&hl=gsw&gl=US\n' +
            '\nApple: https://apps.apple.com/us/app/staycom/id1437743329\n\n' +
            '\nSie erwarten keine Einladung? Geben Sie uns bescheid indem Sie auf diese Mail antworten.\n\n' +
            '\nViele Grüße und viel Erfolg, wünscht Ihnen Ihr Team von\n\n Deimach' +
            '\n\n--\n' +
            "\nImpressum: https://deimach.de/impressum/",


    };
    try {
        transporter.sendMail(mailOptions);
    } catch (err) {
        console.log(err);
        return res.status(500).send({});
    }

    // let refreshToken = jwt.sign({id: user._id}, config.secret, {});
    // let userAccessToken = jwt.sign({id: user._id, scopes: user.scopes}, config.secret, {
    //     expiresIn: 14400 // expires in
    // });
    // userAccessToken = user.flags.includes("invalid") ? null : userAccessToken;
    // userAccessToken = user.flags.includes("changePW") ? null : userAccessToken;

    return res.status(200).send(trimUser(user, consultant));
});


router.post('/uploadImage', imageUpload.single('image'), [
    header('x-access-token')
        .exists({checkNull: true}).withMessage("NoAccessToken"),
], async (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).send(["FileUploadError"]);
    }
    res.status(200).send({bUploaded: true});
});

router.post('/register', [
    header('x-access-token')
        .exists({checkNull: true}).withMessage("NoAccessToken"),
    body('name')
        .trim()
        .exists({checkNull: true}).withMessage("NoName"),
    body('firstName')
        .trim()
        .exists({checkNull: true}).withMessage("NoFirstName"),
    body('email')
        .trim().normalizeEmail()
        .exists({checkNull: true}).withMessage("NoEmail")
        .isEmail().withMessage("InvalidEmail"),
    body('yearOfBirth')
        .trim()
        .isNumeric().withMessage("InvalidYoB")
        .isLength({min: 4, max: 4}).withMessage("InvalidYoB")
        .optional(),
    body('residence')
        .trim()
        .custom(isAlphaString).withMessage("InvalidResidence")
        .optional(),
    body('job')
        .trim()
        .custom(isAlphaString).withMessage("InvalidJob")
        .optional(),
    body('note')
        .trim()
        .custom(isAlphaString).withMessage("InvalidJob")
        .optional(),
    body('diagnose')
        .trim()
        .custom(isAlphaString).withMessage("InvalidJob")
        .optional(),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }

    let accessToken = req.headers['x-access-token'];
    let decoded;
    try {
        decoded = await jwt.verify(accessToken, config.secret);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    if (!decoded.id || !(decoded.scopes.includes("admin") || decoded.scopes.includes("consultant"))) return res.status(403).send(["InvalidAccessToken"]);

    let consultant;
    try {
        consultant = await User.findById(decoded.id);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }

    // if (consultant.registerCounter == null || consultant.registerCounter < 1) {
    //     return res.status(403).send(["NoMoreRegistrations"]);
    // }
    let consultantName = consultant.firstName + " " + consultant.name
    let randomstring = Math.random().toString(36).slice(-8);
    let hashedPassword = bcrypt.hashSync(randomstring, 8);

    let user = new User({
        firstName: req.body.firstName,
        name: req.body.name,
        email: req.body.email,
        yearOfBirth: req.body.yearOfBirth,
        residence: req.body.residence,
        job: req.body.job,
        password: hashedPassword,
        scopes: ["user"],
        flags: ["changePW"],
        consultants: [consultant],
        note: req.body.note,
        diagnose: req.body.diagnose
    });
    try {
        user = await user.save();
    } catch (err) {
        if (err.code === 11000) {
            try {
                user = await User.findOne({
                    email: req.body.email
                });
            } catch (err) {
                return res.status(500).send({});
            }
            user.consultants.addToSet(consultant);
            try {
                user = await user.save();
            } catch (err) {
                return res.status(500).send({})
            }
        } else {
            return res.status(500).send({});
        }
    }

    consultant.users.addToSet(user);
    // consultant.registerCounter = consultant.registerCounter - 1;
    try {
        consultant.save();
    } catch (err) {
        return res.status(500).send(saveErrorWrapper(err))
    }

    let refreshToken = jwt.sign({id: user._id}, config.secret, {});
    let userAccessToken = jwt.sign({id: user._id, scopes: user.scopes}, config.secret, {
        expiresIn: 14400 // expires in
    });
    userAccessToken = user.flags.includes("invalid") ? null : userAccessToken;
    userAccessToken = user.flags.includes("changePW") ? null : userAccessToken;

    //Mail an Enduser
    let mailOptions = {
            from: '"Deimach" <support@deimach.de>',
            to: req.body.email, // list of receivers
            subject: 'Willkommen bei StayCom!', // Subject line
            text:
                'Hallo ' + user.firstName + " " + user.name + "," +
                '\n\nDu wurdest von ' + consultantName + 'bei Staycom registriert.\n' +
                '\nUm zu starten, klicke bitte auf den untenstehenden Link und lege ein persönliches Passwort fest.\n' +
                //'\nUm zu starten, melden Sie sich bitte in der App mit den untenstehenden Anmeldedaten an.\n' +
                '\n\nWichtig! Geben Sie niemals Ihr Passwort weiter!\n\n' +
                '\nhttps://www.staycom.deimach.de/complete-registration/' + req.body.email + "/" + randomstring +
                '\n\nAlternativ kannst du dein Passwort auch in der App festlegen, indem du dich mit folgenden Anmeldedaten einloggst: \n' +
                '\n\nE-Mail: ' + req.body.email + "\n" +
                '\nPasswort: ' + randomstring + '\n\n' +
                '\nApp nocht nicht Installiert? Hier downloaden!\n' +
                '\nAndroid: https://play.google.com/store/apps/details?id=com.deimach.staycom&hl=gsw&gl=US\n' +
                '\nApple: https://apps.apple.com/us/app/staycom/id1437743329\n\n' +
                '\nSie erwarten keine Einladung? Geben Sie uns bescheid indem Sie auf diese Mail antworten.\n\n' +
                '\nViele Grüße und viel Erfolg, wünscht Ihnen Ihr Team von\n Deimach' +
                '\n\n--\n' +
                "\nImpressum: https://deimach.de/impressum/",

        }
    ;
    try {
        transporter.sendMail(mailOptions);
    } catch (err) {
        console.log(err);
        return res.status(500).send({});
    }

    return res.status(200).send(trimUser(user, consultant));
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
router.patch('/registerResendMail', [
    header('x-access-token')
        .exists({checkNull: true}).withMessage("NoAccessToken"),
    body('email')
        .trim().normalizeEmail()
        .exists({checkNull: true}).withMessage("NoEmail")
        .isEmail().withMessage("InvalidEmail"),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }

    let accessToken = req.headers['x-access-token'];
    let decoded;
    try {
        decoded = await jwt.verify(accessToken, config.secret);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    if (!decoded.id || !(decoded.scopes.includes("admin"))) return res.status(403).send(["InvalidAccessToken"]);

    let user;
    try {
        user = await User.findOne({
            email: req.body.email
        });
    } catch (err) {
        return res.status(200).send({});
    }

    let pwString;
    if (req.body.password) {
        pwString = req.body.password;
    } else {
        pwString = Math.random().toString(36).slice(-8);
    }
    let hashedPassword = bcrypt.hashSync(pwString, 8);
    let consultantName = consultant.firstName + " " + consultant.name

    user.password = hashedPassword;
    try {
        user.save();
    } catch (err) {
        return res.status(500).send({})
    }

    let mailOptions = {
            from: '"Deimach" <support@deimach.de>',
            to: req.body.email, // list of receivers
            subject: 'Willkommen bei StayCom!', // Subject line
            text:
                'Hallo ' + user.firstName + " " + user.name + "," +
                '\n\nDu wurdest von ' + consultantName + 'bei Staycom registriert.\n' +
                '\nUm zu starten, klicke bitte auf den untenstehenden Link und lege ein persönliches Passwort fest.\n' +
                //'\nUm zu starten, melden Sie sich bitte in der App mit den untenstehenden Anmeldedaten an.\n' +
                '\n\nWichtig! Geben Sie niemals Ihr Passwort weiter!\n\n' +
                '\nhttps://www.staycom.deimach.de/complete-registration/' + req.body.email + "/" + pwString +
                '\n\nAlternativ kannst du dein Passwort auch in der App festlegen, indem du dich mit folgenden Anmeldedaten einloggst: \n' +
                '\n\nE-Mail: ' + req.body.email + "\n" +
                '\nPasswort: ' + pwString + '\n\n' +
                '\nApp nocht nicht Installiert? Hier downloaden!\n' +
                '\nAndroid: https://play.google.com/store/apps/details?id=com.deimach.staycom&hl=gsw&gl=US\n' +
                '\nApple: https://apps.apple.com/us/app/staycom/id1437743329\n\n' +
                '\nSie erwarten keine Einladung? Geben Sie uns bescheid indem Sie auf diese Mail antworten.\n\n' +
                '\nViele Grüße und viel Erfolg, wünscht Ihnen Ihr Team von\n Deimach' +
                '\n\n--\n' +
                "\nImpressum: https://deimach.de/impressum/",
        }
    ;
    try {
        transporter.sendMail(mailOptions);
    } catch (err) {
        console.log(err);
        return res.status(500).send({});
    }

    return res.status(200).send({password: pwString});
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
router.patch('/editUser', [
    header('x-access-token')
        .exists({checkNull: true}).withMessage("NoAccessToken"),
    body('_id')
        .exists({checkNull: true}).withMessage("NoID"),
    body('firstName')
        .trim()
        .optional(),
    body('name')
        .trim()
        .optional(),
    body('email')
        .trim().normalizeEmail()
        .isEmail().withMessage("InvalidEmail")
        .optional(),
    body('yearOfBirth')
        .trim()
        .isNumeric().withMessage("InvalidYoB")
        .isLength({min: 4, max: 4}).withMessage("InvalidYoB")
        .optional(),
    body('residence')
        .trim()
        .custom(isAlphaString).withMessage("InvalidResidence")
        .optional(),
    body('job')
        .trim()
        .custom(isAlphaString).withMessage("InvalidJob")
        .optional(),
    body('note')
        .trim()
        .custom(isAlphaString).withMessage("InvalidJob")
        .optional(),
    body('diagnose')
        .trim()
        .custom(isAlphaString).withMessage("InvalidJob")
        .optional(),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }
    let accessToken = req.headers['x-access-token'];
    let decoded;
    try {
        decoded = await jwt.verify(accessToken, config.secret);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }

    //decoded.id = "5d2f16f5d06ba536ae77209a"
    if (!decoded.id || !(decoded.scopes.includes("admin") || decoded.scopes.includes("consultant"))) return res.status(403).send(["InvalidAccessToken"]);

    let consultant;
    try {
        consultant = await User.findById(decoded.id);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }

    if (decoded.scopes.includes("admin") && !consultant.users.map((userID) => userID.toString()).includes(req.body._id)) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    let user = {
        firstName: req.body.firstName,
        name: req.body.name,
        email: req.body.email,
        yearOfBirth: req.body.yearOfBirth,
        residence: req.body.residence,
        job: req.body.job,
        note: req.body.note,
        diagnose: req.body.diagnose
    }
    Object.keys(user).forEach(key => !user[key] && delete user[key])

    let editedUser
    try {
        editedUser = await User.findOneAndUpdate({_id: req.body._id}, user, {new: true});
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    return res.status(200).send(trimUser(editedUser, consultant));
});

router.patch('/removeUserConsultant', [
    header('x-access-token')
        .exists({checkNull: true}).withMessage("NoAccessToken"),
    body('_id')
        .exists({checkNull: true}).withMessage("NoID"),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }
    let accessToken = req.headers['x-access-token'];
    let decoded;
    try {
        decoded = await jwt.verify(accessToken, config.secret);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    //decoded.id = "5d2f16f5d06ba536ae77209a"
    if (!decoded.id || !(decoded.scopes.includes("admin") || decoded.scopes.includes("consultant"))) return res.status(403).send(["InvalidAccessToken"]);

    try {
        //Removed due to discontinued multiusers
        if (decoded.scopes.includes("admin")) {
            User.deleteOne({_id: req.body._id}).exec();
        } else {
            User.updateOne({_id: req.body._id}, {$pullAll: {consultants: [decoded.id]}}).exec()
        }
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    return res.status(200).send();
});

router.get('/myUsers', [
    header('x-access-token')
        .exists({checkNull: true}).withMessage("NoAccessToken"),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }
    let accessToken = req.headers['x-access-token'];
    let decoded;
    try {
        decoded = await jwt.verify(accessToken, config.secret);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    //decoded.id = "5d2f16f5d06ba536ae77209a"
    if (!decoded.id || !(decoded.scopes.includes("admin") || decoded.scopes.includes("consultant"))) return res.status(403).send(["InvalidAccessToken"]);

    let consultant;
    try {
        consultant = await User.findById(decoded.id);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }

    let users;

    try {
        if (decoded.scopes.includes("admin")) {
            users = await User.find({scopes: "consultant"});
        } else {
            users = await User.find({consultants: consultant._id});
        }
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    console.log(users)
    // if (!users) {
    //     return res.status(403).send(["InvalidAccessToken"]);
    // }

    users = users.map((user) => trimUser(user, consultant));
    return res.status(200).send(users);
});

//////////----BEGIN----/////////////-------------------------------------------------------------------------------------------------------------------///////////////////////////////////////////////////////////////////////
///**** DEBUG CODEEEEE//-------------------------------------------------------------------------------------------------------------------///////////////////////////////////////////////////////////////////////
router.post('/newDEVNEWLayout', [
    // header('x-access-token')
    //     .exists({checkNull: true}).withMessage("NoAccessToken"),
    // body('UIElements')
    //     .exists({checkNull: true}).withMessage("NoUIElements"),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }
    let consultants = await User.find({layout: {$exists: true}}).populate("users");

    let layoutGroup = await Layout.aggregate([
        {"$match": {"$or": [{"consultant": {"$exists": false}}, {"consultant": consultants[1]._id}]}},
        {"$sort": {"layoutID": 1, "version": -1}},
        {
            "$group": {
                "_id": "$layoutID",
                "version": {"$first": "$version"},
                "actualIDofLayout": {"$first": "$_id"},
            }
        }
    ]).exec();
    let mostRecentLayoutIDs = layoutGroup.map((layoutGroupObj) => layoutGroupObj.actualIDofLayout);
    let myLayouts = await Layout.find({_id: mostRecentLayoutIDs})

    let allManagedUsers = [];
    let syncedConsList = [];
    let allusers = await User.find()
        .populate({
            path: 'consultants',
            populate: {
                path: 'layout',
            }
        })
        .populate("layout");
    for (let user of allusers) {
        let layout;
        if (user.scopes.includes("consultant")) {
            layout = user.layout;
        } else {
            layout = _.get(user, 'consultants[0].layout');
        }
        if (!layout) {
            continue;
        }
        user.layouts = [layout.layoutID]
        try {
            user.save();
        } catch (err) {
            return res.status(500).send(saveErrorWrapper(err))
        }
    }
    try {
        user.save();
    } catch (err) {
        return res.status(500).send(saveErrorWrapper(err))
    }
    // for (let myCons of consultants) {
    //     for (let user of myCons.users) {
    //         // console.log(user.firstName + " " + user.name + " is managed by " + myCons.firstName)
    //             let layouts = await Layout.find({consultant: myCons._id});
    //             let uuid = uuidv4();
    //             let name = "Layout Nr.1 von "+myCons.firstName+" "+myCons.name;
    //             // let test ="debug"
    //             for(let layout of layouts){
    //                 if(!layout.name) {
    //                     layout.set("layoutID", uuid);
    //                     layout.set("name", name);
    //                     try {
    //                         let savedLayout = await layout.save({strict: false});
    //                         let test = "debug";
    //                     } catch (err) {
    //                         return res.status(403).send(["DuplicateIdentifiers"]);
    //                     }
    //                     console.log(layout.version + "\t" + layout._id + "\t" + layout.consultant.firstName + "\t" + myCons.firstName)
    //                 }
    //             }
    // let managedUserIndex = allManagedUsers.indexOf(user.firstName + " "+user.name);
    // if(managedUserIndex>0){
    //     console.log(user.firstName + " "+user.name+" is managed by "+syncedConsList[managedUserIndex]+" and ");
    //     console.log(user.firstName + " "+user.name+" is managed by "+myCons.firstName)
    // }
    // allManagedUsers.push(user.firstName + " "+user.name);
    // syncedConsList.push(myCons.firstName);
    //     }
    // }
    //     let layouts = await Layout.find({consultant: myCons._id});
    //     let uuid = uuidv4();
    //     let name = "Layout Nr.1 von "+myCons.firstName+" "+myCons.name;
    //     let test ="debug"
    //     for(let layout of layouts){
    //         layout.set("layoutID",uuid);
    //         layout.set("name",name);
    //         try{
    //             let savedLayout = await layout.save({strict:false});
    //             let test = "debug";
    //         }catch(err){
    //             return res.status(403).send(["DuplicateIdentifiers"]);
    //         }
    //         console.log(layout.version+"\t"+layout._id+"\t"+layout.consultant.firstName+"\t"+myCons.firstName)
    //     }
    // }
    // let allByConsultant = await Layout.find({consultant: "5d2f1718d06ba536ae77209b"}).sort({version: -1});
    // Layout.find({consultant: decoded.id}).sort({version: -1});
    //------------------END DEBUG CODE-------------------------------------------------------------------------------------------------------///////////////////////////////////////////////////////////////////////


    // Layout.findOne({consultant: decoded.id}).sort({version: -1});
    //
    //
    // let valueArr = req.body.UIElements.map(function (uiElement) {
    //     return uiElement.identifier
    // });
    // let isDuplicate = valueArr.some(function (item, idx) {
    //     return valueArr.indexOf(item) !== idx;
    // });
    // if (isDuplicate) {
    //     return res.status(403).send(["DuplicateIdentifiers"]);
    // }
    //
    // let accessToken = req.headers['x-access-token'];
    // let decoded;
    // try {
    //     decoded = await jwt.verify(accessToken, config.secret);
    // } catch (err) {
    //     return res.status(403).send(["InvalidAccessToken"]);
    // }
    // if (!decoded.id || !(decoded.scopes.includes("admin") || decoded.scopes.includes("consultant"))) return res.status(403).send(["InvalidAccessToken"]);
    //
    // // Layout.findOne({consultant: decoded.id}).sort({version: -1});
    // let newestLayout;
    // let version;
    // try {
    //     newestLayout = await Layout.findOne({consultant: decoded.id}).sort({version: -1});
    // } catch (err) {
    //     return res.status(403).send(["InvalidAccessToken"]);
    // }
    // if (!newestLayout) {
    //     version = 1;
    // } else {
    //     version = newestLayout.version + 1;
    // }
    //
    // let layout = new Layout({
    //     consultant: decoded.id,
    //     version: version,
    //     uiElements: req.body.UIElements
    // });
    // try {
    //     await layout.save();
    // } catch (err) {
    //     return res.status(500).send(saveErrorWrapper(err))
    // }
    //
    // let consultant;
    // try {
    //     consultant = await User.findById(decoded.id);
    // } catch (err) {
    //     return res.status(403).send(["InvalidAccessToken"]);
    // }
    //
    // consultant.layout = layout;
    // try {
    //     await consultant.save();
    // } catch (err) {
    //     return res.status(500).send(saveErrorWrapper(err))
    // }
    //
    // return res.status(200).send({
    //     auth: true,
    // });
});
router.post('/setAlias', [
    header('x-access-token')
        .exists({checkNull: true}).withMessage("NoAccessToken"),
    body('_id')
        .exists({checkNull: true}).withMessage("NoId"),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }
    let accessToken = req.headers['x-access-token'];

    let decoded;
    try {
        decoded = await jwt.verify(accessToken, config.secret);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    if (!decoded.id || !(decoded.scopes.includes("admin") || decoded.scopes.includes("consultant"))) return res.status(403).send(["InvalidAccessToken"]);

    let documentationAlias;
    try {
        documentationAlias = await DocumentationAlias.findById(req.body._id);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    if (!documentationAlias || !documentationAlias.consultant) return res.status(403).send(["InvalidAccessToken"]);
    if (documentationAlias.consultant.toString() !== decoded.id.toString()) return res.status(403).send(["InvalidAccessToken"]);
    documentationAlias.sessionNumber = req.body.sessionNumber ? req.body.sessionNumber : documentationAlias.sessionNumber;
    documentationAlias.diagnosis = req.body.diagnosis ? req.body.diagnosis : documentationAlias.diagnosis;
    documentationAlias.notes = req.body.notes ? req.body.notes : documentationAlias.notes;

    try {
        documentationAlias = await documentationAlias.save();
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }

    return res.status(200).send(documentationAlias)
});

router.post('/setPraxis', [
    header('x-access-token')
        .exists({checkNull: true}).withMessage("NoAccessToken"),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }
    let accessToken = req.headers['x-access-token'];

    let decoded;
    try {
        decoded = await jwt.verify(accessToken, config.secret);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    if (!decoded.id || !(decoded.scopes.includes("admin") || decoded.scopes.includes("consultant"))) return res.status(403).send(["InvalidAccessToken"]);

    let consultant;
    try {
        consultant = await User.findById(decoded.id);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }

    let praxis
    if (consultant.praxis) {
        try {
            praxis = await Praxis.findById(consultant.praxis);
        } catch (err) {
            return res.status(403).send(["InvalidAccessToken"]);
        }
        praxis = Object.assign(praxis, req.body.praxis)
    } else {
        // praxis = new Praxis
        praxis = new Praxis(
            req.body.praxis
        );
    }
    praxis.user = consultant._id
    try {
        praxis = await praxis.save();
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    consultant.praxis = praxis._id;
    try {
        consultant = await consultant.save();
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }

    return res.status(200).send(praxis)
});

router.get('/getPraxis', [
    header('x-access-token')
        .exists({checkNull: true}).withMessage("NoAccessToken"),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }
    let accessToken = req.headers['x-access-token'];

    let decoded;
    try {
        decoded = await jwt.verify(accessToken, config.secret);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    if (!decoded.id || !(decoded.scopes.includes("admin") || decoded.scopes.includes("consultant"))) return res.status(403).send(["InvalidAccessToken"]);

    let consultant;
    try {
        consultant = await User.findById(decoded.id);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }

    let praxis
    if (consultant.praxis) {
        try {
            praxis = await Praxis.findById(consultant.praxis);
        } catch (err) {
            return res.status(403).send(["InvalidAccessToken"]);
        }
        return res.status(200).send(praxis);
    } else {
        return res.status(200).send();
    }
});


router.post('/newAlias', [
    header('x-access-token')
        .exists({checkNull: true}).withMessage("NoAccessToken"),
    body('alias')
        .exists({checkNull: true})
        .custom(isAlphaString)
        .withMessage("NoAlias"),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }
    let accessToken = req.headers['x-access-token'];

    let decoded;
    try {
        decoded = await jwt.verify(accessToken, config.secret);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    if (!decoded.id || !(decoded.scopes.includes("admin") || decoded.scopes.includes("consultant"))) return res.status(403).send(["InvalidAccessToken"]);

    let documentationAlias = new DocumentationAlias({
        sessionNumber: 0,
        consultant: decoded.id,
        alias: req.body.alias
    });
    documentationAlias.diagnosis = req.body.diagnosis ? req.body.diagnosis : documentationAlias.diagnosis;
    documentationAlias.notes = req.body.notes ? req.body.notes : documentationAlias.notes;

    try {
        documentationAlias = await documentationAlias.save();
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }

    return res.status(200).send(documentationAlias)
});

router.get('/myAlias', [
    header('x-access-token')
        .exists({checkNull: true}).withMessage("NoAccessToken"),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }
    let accessToken = req.headers['x-access-token'];

    let decoded;
    try {
        decoded = await jwt.verify(accessToken, config.secret);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    if (!decoded.id || !(decoded.scopes.includes("admin") || decoded.scopes.includes("consultant"))) return res.status(403).send(["InvalidAccessToken"]);

    let aDocumentationAlias;
    try {
        aDocumentationAlias = await DocumentationAlias.find({consultant: decoded.id});
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }

    return res.status(200).send(aDocumentationAlias)
});


router.post('/assignUserLayouts', [
    header('x-access-token')
        .exists({checkNull: true}).withMessage("NoAccessToken"),
    body('user')
        .exists({checkNull: true}).withMessage("NoUIElements"),
    body('layouts')
        .exists({checkNull: true}).withMessage("NoUIElements"),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }
    let accessToken = req.headers['x-access-token'];

    let decoded;
    try {
        decoded = await jwt.verify(accessToken, config.secret);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    if (!decoded.id || !(decoded.scopes.includes("admin") || decoded.scopes.includes("consultant"))) return res.status(403).send(["InvalidAccessToken"]);

    let consultant;
    try {
        consultant = await User.findById(decoded.id);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }

    let user;
    try {
        user = await User.findById(req.body.user);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }

    if (!decoded.scopes.includes("admin") && !consultant.users.map((userID) => userID.toString()).includes(user._id.toString())) {
        return res.status(403).send(["InvalidAccessToken"]);
    }

    // let oQuery=[];
    // if(!decoded.scopes.includes("admin")) {
    //     oQuery.push({
    //         "$match": {
    //             "$or": [{"consultant": {"$exists": false}}, {"consultant": mongoose.mongo.ObjectId(decoded.id)}, user.consultants.map((cons) => {
    //                 return {"consultant": mongoose.mongo.ObjectId(cons)}
    //             })]
    //         }
    //     });
    // }
    // oQuery.push({"$match": {"layoutID": {"$in": req.body.layouts}}});
    // oQuery.push({"$sort": {"layoutID": 1, "version": -1}});
    // oQuery.push({
    //     "$group": {
    //         "_id": "$layoutID",
    //         "myLayout": {"$first":"$$ROOT"}
    //     }
    // });
    // let layoutGroup = await Layout.aggregate(oQuery).exec();
    // let myLayouts = layoutGroup.map((layoutGroupObj) => layoutGroupObj.myLayout);
    for (let reqLayoutID of req.body.layouts) {
        let layout;
        try {
            layout = await Layout.findOne({"layoutID": reqLayoutID});
        } catch (err) {
            return res.status(403).send(["InvalidAccessToken"]);
        }
        if (!decoded.scopes.includes("admin") && layout.consultant && !layout.consultant.equals(decoded.id)) {
            return res.status(403).send(["InvalidAccessToken"]);
        }
    }

    user.layouts = req.body.layouts
    try {
        user = await user.save();
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }

    return res.status(200).send(trimUser(user, consultant))
    // if(!user.consultants.includes(decoded.id)) return res.status(403).send(["InvalidAccessToken"]);

    //TODO add check if layout is ok to be assigned

});

router.post('/newLayout', [
    header('x-access-token')
        .exists({checkNull: true}).withMessage("NoAccessToken"),
    body('UIElements')
        .exists({checkNull: true}).withMessage("NoUIElements"),
    body('name')
        .exists({checkNull: true}).withMessage("NoName"),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }

    let valueArr = req.body.UIElements.map(function (uiElement) {
        return uiElement.identifier
    });
    let isDuplicate = valueArr.some(function (item, idx) {
        return valueArr.indexOf(item) !== idx;
    });
    if (isDuplicate) {
        return res.status(403).send(["DuplicateIdentifiers"]);
    }

    let accessToken = req.headers['x-access-token'];
    let decoded;
    try {
        decoded = await jwt.verify(accessToken, config.secret);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    if (!decoded.id || !(decoded.scopes.includes("admin") || decoded.scopes.includes("consultant"))) return res.status(403).send(["InvalidAccessToken"]);


    let newestLayout;
    let version;
    try {
        newestLayout = await Layout.findOne({$and: [{consultant: decoded.id}, {name: req.body.name}]}).sort({version: -1});
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    if (!!newestLayout && (!req.body.layoutID || (req.body.layoutID && req.body.layoutID !== newestLayout.layoutID))) {
        return res.status(403).send(["DuplicateName"]);
    }

    if (!newestLayout) {
        version = 1;
    } else {
        version = newestLayout.version + 1;
    }
    let myConsID = decoded.id;
    if (decoded.scopes.includes("admin") && req.body.consultant) {
        myConsID = req.body.consultant;
    }
    let layout = new Layout({
        consultant: myConsID,
        version: version,
        uiElements: req.body.UIElements,
        name: req.body.name,
        ...(req.body.layoutID && {layoutID: req.body.layoutID})
    });
    try {
        layout = await layout.save();
    } catch (err) {
        return res.status(500).send(saveErrorWrapper(err))
    }

    // let consultant;
    // try {
    //     consultant = await User.findById(decoded.id);
    // } catch (err) {
    //     return res.status(403).send(["InvalidAccessToken"]);
    // }
    //
    // consultant.layout = layout;
    // try {
    //     await consultant.save();
    // } catch (err) {
    //     return res.status(500).send(saveErrorWrapper(err))
    // }

    return res.status(200).send(layout);
});

///////////////////////-------------------------------------------------------------------------------------------------------------------///////////////////////////////////////////////////////////////////////

router.patch('/changePwToken', [
    body('password')
        .exists({checkNull: true}).withMessage("NoPassword"),
    body('changeToken')
        .exists({checkNull: true}).withMessage("NoChangeToken"),
    body('email')
        .trim().normalizeEmail()
        .exists({checkNull: true}).withMessage("NoEmail")
        .isEmail().withMessage("InvalidEmail"),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }

    let user;
    try {
        user = await User.findOne({
            email: req.body.email
        });
    } catch (err) {
        return res.status(403).send(["InvalidPwChange"]);
    }

    let hashedPassword = bcrypt.hashSync(req.body.password, 8);
    if (!bcrypt.compareSync(req.body.changeToken, user.changeToken)) {
        return res.status(403).send(["InvalidPwChange"]);
    }
    let now = new Date();
    if (now > user.changeTokenExpiry) {
        return res.status(403).send(["InvalidPwChange"]);
    }
    user.flags = [...user.flags, "acceptedDataAgreement"]
    user.password = hashedPassword;
    user.changeTokenExpiry = now;
    try {
        user.save();
    } catch (err) {
        return res.status(500).send({})
    }
    return res.status(200).send({message: "Changed successfully"});
});

router.patch('/resetUserPassword', [
    header('x-access-token')
        .exists({checkNull: true}).withMessage("NoAccessToken"),
    body('email')
        .trim().normalizeEmail()
        .exists({checkNull: true}).withMessage("NoEmail")
        .isEmail().withMessage("InvalidEmail"),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }

    let accessToken = req.headers['x-access-token'];
    let decoded;
    try {
        decoded = await jwt.verify(accessToken, config.secret);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    if (!decoded.id || !(decoded.scopes.includes("admin"))) return res.status(403).send(["InvalidAccessToken"]);

    let user;
    try {
        user = await User.findOne({
            email: req.body.email
        });
    } catch (err) {
        return res.status(200).send({});
    }

    let pwString;
    if (req.body.password) {
        pwString = req.body.password;
    } else {
        pwString = Math.random().toString(36).slice(-8);
    }
    let hashedPassword = bcrypt.hashSync(pwString, 8);

    user.password = hashedPassword;
    try {
        user.save();
    } catch (err) {
        return res.status(500).send({})
    }

    return res.status(200).send({password: pwString});
});

router.patch('/pwChangeRequest', [
    body('email')
        .trim().normalizeEmail()
        .exists({checkNull: true}).withMessage("NoEmail")
        .isEmail().withMessage("InvalidEmail"),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }

    let rawToken = Math.random().toString(36).slice(-8);
    let changeToken = bcrypt.hashSync(rawToken, 8); //TODO: Double check if this should/needs to be hashed

    let user;
    try {
        user = await User.findOne({
            email: req.body.email
        });
    } catch (err) {
        return res.status(200).send({});
    }
    user.changeToken = changeToken;
    let expiry = new Date();
    expiry.setHours(expiry.getHours() + 1);
    let changeTokenExpiry = expiry;
    user.changeTokenExpiry = changeTokenExpiry;
    let mailOptions = {
        from: '"Deimach" <support@deimach.de>',
        to: req.body.email, // list of receivers
        subject: 'Passwort Änderung', // Subject line
        text: 'Hier ist ihr token zum ändern ihres Passwortes:' + rawToken, // plain text body
        html: '<p>Hier ist ihr token zum ändern ihres Passwortes:</p><b>' + rawToken + '</b>' // html body
    };
    try {
        user.save();
    } catch (err) {
        return res.status(500).send({})
    }
    if (process.env.NODE_ENV === "development") {
        console.log(rawToken);
        return res.status(200).send({});
    } else {
        try {
            transporter.sendMail(mailOptions);
        } catch (err) {
            console.log(err);
            return res.status(500).send({});
        }
        return res.status(200).send({});
    }
});


router.patch('/changepw', [
    header('x-refresh-token')
        .exists({checkNull: true}).withMessage("NoRefreshToken"),
    body('password')
        .exists({checkNull: true}).withMessage("NoPassword"),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }

    let hashedPassword = bcrypt.hashSync(req.body.password, 8);
    let refreshToken = req.headers['x-refresh-token'];

    let decoded;
    try {
        decoded = await jwt.verify(refreshToken, config.secret);
    } catch (err) {
        return res.status(401).send(["InvalidRefreshToken"]);
    }
    if (!decoded.id) return res.status(401).send(["InvalidRefreshToken"]);

    try {
        await User.findOneAndUpdate({
                _id: decoded.id
            },
            {$set: {password: hashedPassword}, $pullAll: {flags: ["changePW"]}}).exec();
    } catch (err) {
        return res.status(500).send("There was a problem changing the password.");
    }
    return res.status(200).send({auth: true, refreshToken: refreshToken});
});

router.get('/getAccessToken', [
    header('x-refresh-token')
        .exists({checkNull: true}).withMessage("NoRefreshToken"),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }

    let refreshToken = req.headers['x-refresh-token'];

    let decoded;
    try {
        decoded = await jwt.verify(refreshToken, config.secret);
    } catch (err) {
        return res.status(401).send(["InvalidRefreshToken"]);
    }
    if (!decoded.id) return res.status(401).send(["InvalidRefreshToken"]);

    let user;
    try {
        user = await User.findById(decoded.id);
    } catch (err) {
        return res.status(401).send(["InvalidRefreshToken"]);
    }
    if (!await getPaymentStatus(user)) return res.status(401).send(["NoPayment"]);
    let accessToken = jwt.sign({id: user._id, scopes: user.scopes}, config.secret, {
        expiresIn: 14400 // expires in
    });
    accessToken = user.flags.includes("invalid") ? null : accessToken;
    accessToken = user.flags.includes("changePW") ? null : accessToken;
    return res.status(200).send({
        auth: true,
        refreshToken: refreshToken,
        accessToken: accessToken,
        flags: user.flags,
        user: trimUser(user, user)
    });
    //return res.status(200).send({auth: true, accessToken: accessToken, flags: user.flags});
});

//TODO: Update for dynamic layout and async
router.get('/getAllEntries', [
    query('accessToken')
        .exists({checkNull: true}).withMessage("NoAccessToken"),
    query('user')
        .exists({checkNull: true}).withMessage("NoAccessToken"),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }

    let accessToken = req.query.accessToken;

    let decoded;
    try {
        decoded = await jwt.verify(accessToken, config.secret);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }

    let user;
    try {
        user = await User.findById(req.query.user);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    if (!decoded.scopes.includes("admin") && !user.consultants.includes(decoded.id)) return res.status(403).send(["InvalidAccessToken"]);
    if (!decoded.id || !(decoded.scopes.includes("admin") || decoded.scopes.includes("consultant"))) return res.status(403).send(["InvalidAccessToken"]);
    let entryArr;

    try {
        entryArr = await Entry.find({user: req.query.user})
            .populate({
                path: 'layout'
            })
            .populate({
                path: "user",
                select: "-entries"
            })
            .lean()
            .exec();
    } catch (err) {
        return res.status(500).send({});
    }

    entryArr = entryArr.sort((a, b) => {
        if (!a.layout.layoutID && !b.layout.layoutID) {
            return 0;
        } else if (!a.layout.layoutID) {
            return 1
        } else if (!b.layout.layoutID) {
            return -1
        }
        return a.layout.layoutID.localeCompare(b.layout.layoutID)
    });

    let uiIdSet = new Set();
    for (let entry of entryArr) {
        for (let i = 0; i < entry.values.length; i++) {
            uiIdSet.add(entry.values[i].identifier);
        }
    }
    uiIdSet = Array.from(uiIdSet);

    //TODO: Figure out how to filter this on db
    let wb = new xl.Workbook();
    if (entryArr.length === 0) {
        return res.status(500).send({});
    }
    let currentLayout = null;
    let entryIndex = 2;
    let ws;
    for (let entry of entryArr) {
        if (!currentLayout || !(currentLayout.layoutID === entry.layout.layoutID)) {
            currentLayout = entry.layout;
            let worksheetName = currentLayout.name || "Unbenanntes Layout";
            ws = wb.addWorksheet(worksheetName);
            ws.cell(1, 1).string("Zeitpunkt des Eintrags");
            for (let i = 0; i < uiIdSet.length; i++) {
                ws.cell(1, i + 2).string(uiIdSet[i])
            }
            entryIndex = 2;
        }
        ws.cell(entryIndex, 1).date(entry.created);
        for (let i = 0; i < entry.values.length; i++) {
            let colPosition = uiIdSet.indexOf(entry.values[i].identifier) + 2;
            ws.cell(entryIndex, colPosition).string(entry.values[i].value.join(", "));
        }
        entryIndex++;
    }
    wb.write("Bericht.xlsx", res);
});

router.post('/login', [
    body('email')
        .trim().normalizeEmail()
        .exists({checkNull: true}).withMessage("NoEmail")
        .isEmail().withMessage("InvalidEmail"),
    body('password')
        .exists({checkNull: true}).withMessage("NoPassword")
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }

    // req.body.email = "info@burkhardgross.de"
    let userArr;
    try {
        userArr = await User.find({email: req.body.email});
    } catch (err) {
        return res.status(401).send(["InvalidLogin"]);
    }
    if (!userArr || userArr.length === 0) return res.status(401).send(["InvalidLogin"]);
    if (userArr.length > 1) return res.status(500).send(["DataInconsistency"]);

    let user = userArr[0];
    if (!bcrypt.compareSync(req.body.password, user.password)) {
        return res.status(401).send(["InvalidLogin"]);
    }

    let refreshToken = jwt.sign({id: user._id}, config.secret, {});
    let accessToken = jwt.sign({id: user._id, scopes: user.scopes}, config.secret, {
        expiresIn: 14400 // expires in
    });
    accessToken = user.flags.includes("invalid") ? null : accessToken;
    accessToken = user.flags.includes("changePW") ? null : accessToken;
    return res.status(200).send({
        auth: true,
        refreshToken: refreshToken,
        accessToken: accessToken,
        flags: user.flags,
        user: trimUser(user, user)
    });
});

router.get('/getFormValues', function (req, res) {
    Globals.findOne({}).sort({version: -1}).exec(function (err, globals) {
        console.log(globals);
        if (err || !globals) return res.status(500).send(["DataInconsistency"]);
        if (!globals.formValues) return res.status(500).send(["DataInconsistency"]);
        if (!globals.version) return res.status(500).send(["DataInconsistency"]);
        return res.status(200).send(globals);
    });
});


router.get('/getLayouts', [
    header('x-access-token')
        .exists({checkNull: true}).withMessage("NoAccessToken"),
    query('layouts')
        .exists({checkNull: true}).withMessage("NoLayoutIds"),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }

    let accessToken = req.headers['x-access-token'];
    let decoded;
    try {
        decoded = await jwt.verify(accessToken, config.secret);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    if (!decoded.id || !(decoded.scopes.includes("admin") || decoded.scopes.includes("consultant"))) return res.status(403).send(["InvalidAccessToken"]);

    let user;
    try {
        user = await User.findById(decoded.id);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    if (!user) return res.status(403).send(["InvalidAccessToken"]);

    req.query.layouts = JSON.parse(req.query.layouts);
    if (!req.query.layouts || req.query.layouts < 1) {
        req.query.layouts = user.layouts;
    }
    let userID = mongoose.mongo.ObjectId(decoded.id);
    let oQuery = [];
    if (!decoded.scopes.includes("admin")) {
        oQuery.push({
            "$match": {
                "$or": [{"consultant": {"$exists": false}}, {"consultant": userID}, ...user.consultants.map((cons) => {
                    return {"consultant": mongoose.mongo.ObjectId(cons)}
                })]
            }
        });
    }
    oQuery.push({"$match": {"layoutID": {"$in": req.query.layouts}}});
    oQuery.push({"$sort": {"layoutID": 1, "version": -1}});
    oQuery.push({
        "$group": {
            "_id": "$layoutID",
            "myLayout": {"$first": "$$ROOT"}
        }
    });
    let layoutGroup = await Layout.aggregate(oQuery).exec();
    let myLayouts = layoutGroup.map((layoutGroupObj) => layoutGroupObj.myLayout);
    // let myLayouts = await Layout.find({_id: mostRecentLayoutIDs})
    let myReturnLayouts = myLayouts.map((layout) => {
        return {
            layoutId: layout._id,
            layoutID: layout.layoutID,
            UIElements: layout.uiElements,
            version: layout.version,
            name: layout.name
        }
    });
    return res.status(200).send(myReturnLayouts);
});


router.get('/getAssignableLayouts', [
    header('x-access-token')
        .exists({checkNull: true}).withMessage("NoAccessToken"),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }

    let accessToken = req.headers['x-access-token'];
    let decoded;
    try {
        decoded = await jwt.verify(accessToken, config.secret);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    if (!decoded.id || !(decoded.scopes.includes("admin") || decoded.scopes.includes("consultant"))) return res.status(403).send(["InvalidAccessToken"]);
    let oQuery = [];
    if (decoded.scopes.includes("admin") && req.query.consultant) {
        decoded.id = req.query.consultant
    }
    let consID = mongoose.mongo.ObjectId(decoded.id);
    oQuery.push({"$match": {"$or": [{"consultant": {"$exists": false}}, {"consultant": consID}]}});
    oQuery.push({"$sort": {"layoutID": 1, "version": -1}});
    oQuery.push({
        "$group": {
            "_id": "$layoutID",
            "myLayout": {"$first": "$$ROOT"}
        }
    });
    let layoutGroup = await Layout.aggregate(oQuery).exec();
    let myLayouts = layoutGroup.map((layoutGroupObj) => layoutGroupObj.myLayout);
    // let myLayouts = await Layout.find({_id: mostRecentLayoutIDs})
    let myReturnLayouts = myLayouts.map((layout) => {
        return {
            layoutId: layout._id,
            layoutID: layout.layoutID,
            UIElements: layout.uiElements,
            version: layout.version,
            name: layout.name
        }
    });
    return res.status(200).send(myReturnLayouts);

});

router.get('/getLayout', [
    header('x-access-token')
        .exists({checkNull: true}).withMessage("NoAccessToken"),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }

    let accessToken = req.headers['x-access-token'];
    let decoded;
    try {
        decoded = await jwt.verify(accessToken, config.secret);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    if (!decoded.id) return res.status(403).send(["InvalidAccessToken"]);

    let user;
    try {
        user = await User.findById(decoded.id)
            .populate({
                path: 'consultants',
                populate: {
                    path: 'layout',
                }
            })
            .populate("layout")
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    if (!user) return res.status(403).send(["InvalidAccessToken"]);

    let layout;
    if (user.scopes.includes("consultant")) {
        layout = user.layout;
    } else {
        layout = _.get(user, 'consultants[0].layout');
    }
    if (!layout) {
        return res.status(500).send(["NoLayout"]);
    }

    return res.status(200).send({
        layoutId: layout._id,
        UIElements: layout.uiElements
    });
});

router.post('/deleteEntry', [
    header('x-access-token')
        .exists({checkNull: true}).withMessage("NoAccessToken"),
    body('id')
        .exists({checkNull: true}).withMessage("NoId")
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }

    let accessToken = req.headers['x-access-token'];
    let decoded;
    try {
        decoded = await jwt.verify(accessToken, config.secret);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    if (!decoded.id) return res.status(403).send(["InvalidAccessToken"]);

    let result;
    try {
        result = await Entry.deleteOne({_id: req.body.id, user: decoded.id})
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    if (result.ok !== 1) return res.status(403).send(["FailedDelete"]);

    return res.status(200).send({});
});

router.get('/getEntries', [
    header('x-access-token')
        .exists({checkNull: true}).withMessage("NoAccessToken"),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }

    let accessToken = req.headers['x-access-token'];
    let decoded;
    try {
        decoded = await jwt.verify(accessToken, config.secret);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    if (!decoded.id) return res.status(403).send(["InvalidAccessToken"]);

    let user;
    try {
        user = await User.findById(decoded.id)
            // .populate({path: 'entries', model: Entry})
            .populate({
                path: 'entries',
                model: Entry,
                populate: {
                    path: 'layout',
                }
            })
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }

    return res.status(200).send({
        entries: user.entries,
    });
});

router.post('/newEntry', [
    header('x-access-token')
        .exists({checkNull: true}).withMessage("NoAccessToken"),
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }

    let accessToken = req.headers['x-access-token'];
    let decoded;
    try {
        decoded = await jwt.verify(accessToken, config.secret);
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }
    if (!decoded.id) return res.status(403).send(["InvalidAccessToken"]);

    let user;
    try {
        user = await User.findById(decoded.id)
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }

    let layout;
    try {
        layout = await Layout.findById(req.body.layoutId)
    } catch (err) {
        return res.status(403).send(["InvalidAccessToken"]);
    }

    /*if (!layout.consultant.equals(decoded.id)) {
        var isInArray = user.consultants.some(function (userConsultant) {
            return userConsultant.equals(layout.consultant);
        });
        if (!isInArray) {
            return res.status(403).send(["InvalidAccessToken"]);
        }
    }*/

    let entry = new Entry({
        layout: layout,
        values: req.body.values,
        user: user._id
    });

    try {
        await entry.save();
    } catch (err) {
        return res.status(500).send(saveErrorWrapper(err));
    }

    user.entries.addToSet(entry);
    try {
        user.save();
    } catch (err) {
        return res.status(500).send(saveErrorWrapper(err))
    }

    return res.status(200).send(entry);
});
router.post('/contactUs', [
    body('email')
        .trim().normalizeEmail()
        .exists({checkNull: true}).withMessage("NoEmail")
        .isEmail().withMessage("InvalidEmail"),
    body('text')
        .exists({checkNull: true}),
    body('name')
        .exists({checkNull: true}),
    body('phone')
        .optional()
], async (req, res) => {
    let errors = validationResult(req).formatWith(validationErrorStripper);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array({onlyFirstError: true}));
    }
    let mailOptions = {
        from: '"Deimach" <support@deimach.de>',
        to: 'timo.gross06@gmail.com,hanso.hansen97@gmail.com', // list of receivers
        subject: 'Homepage Contact us E-mail', // Subject line
        text: req.body.text + "\n\n Was sent by " + req.body.name + ". Reply to E-mail Adress: " + req.body.email + ", phone number: " + req.body.phone, // plain text body
        html: "<p>" + req.body.text + "\n\n Was sent by " + req.body.name + ". Reply to E-mail Adress: " + req.body.email + ", phone number: " + req.body.phone + "</p>" // html body
    };
    try {
        transporter.sendMail(mailOptions);
    } catch (err) {
        console.log(err);
        return res.status(500).send({});
    }
    return res.status(200).send({});
});


/*
router.get('/checkUserValidity',[
], function(req, res) {
    let token = req.headers['x-access-token'];
    if (!token) return res.status(401).send({ auth: false, message: 'No token provided.' });
    jwt.verify(token, config.secret, function(err, decoded) {
        if (err) return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });

        User.findById(decoded.id,
            { password: 0 }, // projection
            function (err, user) {
                if (err) return res.status(500).send("There was a problem finding the user.");
                if (!user) return res.status(404).send("No user found.");
                let validityObj={
                    valid: user.valid,
                    changepw: user.changepw,
                    admin: user.admin,
                };
                return res.status(200).send(validityObj);
            });
    });
});
*/
export default router;

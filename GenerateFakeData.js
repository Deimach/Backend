import User from '../user/User'
import faker from 'faker'
import moment from 'moment'
faker.locale = "de";

function generateUserObject(userObject){
    let hashedPassword = bcrypt.hashSync("password", 8);
    let user = {
        firstName: faker.name.firstName(),
        name: faker.name.lastName(),
        email: faker.internet.email(),
        yearOfBirth: faker.date.between(moment().year(1940),moment().year(2000)),
        residence: faker.address.streetAddress(),
        job: faker.name.jobTitle(),
        password: hashedPassword,
        scopes: ["user"],
        flags: ["changePW"],
        consultants: [],
        // registerCounter: 0,
        users: [],
    };
    return Object.assign(user,userObject);
}

async function createUsers(){
    let mainConsultant = generateUserObject({
        email: "consultant@mail.com",
        scopes: ["user", "consultant"],
        flags: [],
        // registerCounter: 20
    });
    mainConsultant = new User(mainConsultant);
    mainConsultant = await mainConsultant.save();

    let user1 = generateUserObject({
        email: "user1@mail.com",
        consultants: [mainConsultant]
    });
    user1 = new User(mainConsultant);
    user1 = await mainConsultant.save();

    let user2 = generateUserObject({
        email: "user2@mail.com",
        consultants: [mainConsultant]
    });
    user2 = new User(mainConsultant);
    user2 = await mainConsultant.save();

    let user3 = generateUserObject({
        email: "user3@mail.com",
        consultants: [mainConsultant]
    });
    user3 = new User(mainConsultant);
    user3 = await mainConsultant.save();

    mainConsultant.users = [user1,user2,user3];
    await mainConsultant.save()
}
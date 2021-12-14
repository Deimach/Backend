let sGetLocaleCharacters= (locale) => {
    switch(locale){
        case "de-DE":
            return "A-ZÄÖÜß";
        default:
            return "A-Z";
    }
};

let isAlphaString = (value) => {
    let stringSeperators = " -";
    let myRegex = "^["+sGetLocaleCharacters("de-DE")+stringSeperators+"]+$";
    myRegex = new RegExp(myRegex,"i");
    return myRegex.test(value)

};

export {isAlphaString};
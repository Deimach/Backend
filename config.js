let seedObject;

if(process.env.NODE_ENV==="development") {
    seedObject = {
        'secret': "asd"
    };
} else {
    let seed = process.env.SEED;
    seedObject = {
        'secret': seed
    };
}

export default seedObject;
# Deimach Backend



## Installation

Use npm i to install dependencies npm run dev to start the server locally.

```bash
npm i
npm run dev
```

## Notes
UIElements are an embedded document type on layout.  
It's Identifiers need to be unique across one layout, but not globally.


Permission check should be done via scopes  
Access permissions are as follows:  
### User
All Users need to have "user" as their scope  
Can read all *public* properties of itself. (This means excluding notes, diagnosis and password)  
Can read all entries created by itself.  
Can read all public Praxis and Layout properties of it's own therapist.
### Therapist
All Therapists need to have "user" and "therapist" as their scope  
Can read all *public and protected* properties of it's Users.  
Can read all entries of it's Users.  
Can read all properties of it's Layouts, UserPayment and Praxis
### Admin
All Users with the "admin" scope have no read or write restrictions.
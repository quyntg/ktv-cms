import {
	initializeApp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js"

import {
	getAuth
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"

import {
	getFirestore
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"

const firebaseConfig = {
    apiKey: "AIzaSyDGEBdrDa-2pZ9nTXwHc5pe8fjpPOBJUCs",
    authDomain: "m-cms-52d25.firebaseapp.com",
    projectId: "m-cms-52d25",
    storageBucket: "m-cms-52d25.firebasestorage.app",
    messagingSenderId: "610029901710",
    appId: "1:610029901710:web:c50fecf90dcd36faa7f6df",
    measurementId: "G-GGQ5WYTY39"
};

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)

export const db = getFirestore(app)
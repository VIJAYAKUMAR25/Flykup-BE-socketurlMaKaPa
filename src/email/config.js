import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user:process.env.MAILING_EMAIL,
        pass:process.env.MAILING_PASSWORD
    },
    tls: {rejectUnauthorized: false}
})

export const mailOptions = {
    from: process.env.MAILING_EMAIL,
    to: '',
    subject:'Sending mail',
    text:'testing from flykup'
}
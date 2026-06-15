import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Tailwind,
  Img,
} from "@react-email/components";
import * as React from "react";

export const EmailTemplate = ({fullName,phoneNumber,email,message,currentTime,currentDate}) => {
  return (
    <Html>
      <Head />
      <Preview>CUPC Website Correspondence</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#eaeaea] rounded my-5 mx-auto p-0 max-w-90 shadow">
            <Section className="bg-blue-900 text-center py-5">
             
              <Heading className="text-white text-[24px] font-normal text-center p-0 my-0 mx-0">
               Chilanga Presbyterian Church
              </Heading>
              <Text className="italic text-white">Walking in Faith, Living in Love</Text>
              <Text className="p-5 bg-red-600 text-white my-5 rounded-full max-w-fit mx-auto font-semibold">NEW CONTACT FORM SUBMISSION</Text>
            </Section>
            
            <Section className="mt-0 text-center min-w-full p-5" >
              <Section className="text-start mt-5  border-[#eaeaea] border-l-4 border-l-red-600 bg-gray-50 px-8 py-3 rounded-2xl">
                <Heading className="text-lg text-black mb-2">CONTACT INFORMATION</Heading>
                <Text className="text-gray-600 my-0 font-semibold">Name:</Text>
                <Text className="mt-0 mb-3">{fullName}</Text>
                <Text className="text-gray-600 my-0 font-semibold">Phone Number:</Text>
                <Text className="mt-0 mb-3">{phoneNumber}</Text>
                <Text className="text-gray-600 my-0 font-semibold">email:</Text>
                <Text className="mt-0 mb-3">{email}</Text>
              </Section>
              <Section className="border-2 border-[#eaeaea] my-5 rounded-2xl px-8 py-5  text-left">

                <Text className="text-gray-600 my-0 font-semibold text-lg ">MESSAGE</Text>
                <Text>{message}</Text>

              </Section>
              <Section className="text-center mt-5 bg-gray-50 px-8 py-3 rounded-2xl">
                <Text className="text-gray-600 my-0 text-xs">RECIEVED ON</Text>
                <Text className="text-black my-0 "><strong>{currentDate}</strong> at <strong className="uppercase">{currentTime}</strong></Text>
              </Section>
            </Section>
            <Section className="bg-blue-900 text-center py-5">
              <Text className="text-gray-200 my-0 text-xs">Copyright ©2026 Chilanga Presbyterian Church</Text>
            </Section>

          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default EmailTemplate;
<%@ page language="java" contentType="text/html; charset=UTF-8"
    pageEncoding="UTF-8"%>
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Insert title here</title>
</head>
<body>
<%

//로그인한 사용한 세션 삭제
session.invalidate();
response.sendRedirect("index.jsp");

%>

</body>
</html>
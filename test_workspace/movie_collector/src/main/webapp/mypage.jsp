<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page import="model.Member"%>
<%@ include file="nav_bar.jsp"%>
<%
Member member = (Member) session.getAttribute("member");
if (member == null) {
	response.sendRedirect("login.jsp");
	return;
}
%>
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>마이페이지</title>

<link rel="stylesheet" href="./bootstrap-3.3.7-dist/css/bootstrap.min.css" />
<style>
body {
	font-family: 'Arial', sans-serif;
	background-color: #f7f7f7;
	margin: 0;
	padding: 0;
}

#main-container {
	min-height: calc(100vh - 100px); /* 헤더 제외한 높이 확보 */
	display: flex;
	justify-content: center;
	align-items: center;
}

#container {
	text-align: center;
	background-color: #fff;
	padding: 40px;
	border-radius: 12px;
	box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}

button {
	display: block;
	width: 250px;
	padding: 15px;
	margin: 20px auto;
	font-size: 18px;
	border: none;
	border-radius: 8px;
	background-color: #007bff;
	color: #fff;
	cursor: pointer;
	transition: background-color 0.3s;
}

button:hover {
	background-color: #0056b3;
}

h2 {
	margin-bottom: 40px;
	color: #333;
}
</style>
</head>
<body>

	<div id="main-container">
		<div id="container">
			<h2><%=member.getNickname()%>님의 마이페이지
			</h2>
			<button onclick="location.href='myreviewpage.do'">작성한 리뷰 보기</button>
			<button onclick="location.href='memberdelete.jsp'">회원탈퇴</button>
		</div>
	</div>

</body>
</html>

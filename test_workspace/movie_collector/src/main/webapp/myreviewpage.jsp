<%@page import="java.util.ArrayList"%>
<%@ page contentType="text/html; charset=UTF-8"%>
<%@ page import="java.util.List"%>
<%@ page import="model.Review"%>
<%@ include file="nav_bar.jsp"%>
<%@ taglib uri="http://java.sun.com/jsp/jstl/functions" prefix="fn"%>
<%
request.setCharacterEncoding("utf-8");
ArrayList<Review> reviewList = (ArrayList<Review>) request.getAttribute("reviewList");
%>

<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>내가 작성한 리뷰</title>
<link rel="stylesheet" href="./bootstrap-3.3.7-dist/css/bootstrap.min.css" />
<style>
body {
	background-color: #f8f9fa;
	font-family: 'Arial', sans-serif;
	margin: 0;
	padding: 0;
}

.container {
	max-width: 900px;
	margin: 60px auto;
	padding: 20px;
}

h1 {
	text-align: center;
	margin-bottom: 40px;
	font-weight: bold;
	color: #333;
}

.review-card {
	background-color: #fff;
	border-radius: 10px;
	box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
	padding: 20px;
	margin-bottom: 20px;
	transition: transform 0.2s ease;
}

.review-card:hover {
	transform: scale(1.02);
}

.review-title {
	font-size: 20px;
	font-weight: bold;
	color: #222;
	margin-bottom: 8px;
}

.review-content {
	font-size: 15px;
	color: #555;
	margin-bottom: 10px;
}

.review-date {
	text-align: right;
	font-size: 13px;
	color: #999;
}
</style>
</head>
<body>

	<div class="container">
		<h1>내가 작성한 리뷰</h1>

		<%
		if (reviewList == null || reviewList.isEmpty() || reviewList.size() == 0) {
		%>
		<p style="text-align: center; color: #888;">작성한 리뷰가 없습니다.</p>
		<%
		} else {
		%>
		<table>
			<thead>
				<tr>
					<th>영화 이름</th>
					<th>점수</th>
					<th>평가</th>
				</tr>
			</thead>
			<tbody>
				<%
				for (Review r : reviewList) {
				%>
				<tr>
					<td><%=r.getMovie_code()%></td>
					<td><%=r.getScore()%></td>
					<td><%=r.getReview()%></td>
				</tr>
				<%
				}
				%>
			</tbody>
		</table>
		<%
		}
		%>
	</div>

</body>
</html>
